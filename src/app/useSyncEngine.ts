// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AuthError,
  ConflictError,
  RateLimitError,
  backoffDelayMs,
  completeDropboxAuth,
  createDropboxAdapter,
  createGdriveAdapter,
  hasPendingDropboxAuth,
  isRetryableSaveError,
  localCacheKey,
  startDropboxAuth,
  startGdriveAuth,
  withLocalCache,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";
import { withEncryption } from "@niclaslindstedt/oss-framework/encryption";
import {
  dropboxPhotoStore,
  gdrivePhotoStore,
  withExternalPhotos,
} from "./photoStore.ts";
import {
  dropboxAttachmentStore,
  gdriveAttachmentStore,
  withExternalAttachments,
} from "./attachmentStore.ts";
import type {
  BackendKind,
  ConnectionProbeResult,
  SaveStatus,
  SyncLocation,
} from "@niclaslindstedt/oss-framework/sync";

import { logStore } from "./log.ts";
import { serializeDoc } from "./migrations.ts";
import {
  evaluateCloudSetup,
  summarizeDoc,
  type CloudDocSummary,
} from "./cloudSetup.ts";
import { docKey, type ContactStore } from "./useContactStore.ts";

// The app's real sync engine — the state machine the framework's `SyncStatus`
// glyph and `SyncDetailsModal` command centre paint over. The local document
// (localStorage, written by `useContactStore`) is always the working copy;
// when a cloud backend is connected the engine pushes the serialized document
// there (debounced on the store's edit counter) and can pull the backend's
// copy back down. Dropbox and Google Drive ride the framework's storage
// adapters; the optional at-rest encryption wraps the byte boundary with
// `withEncryption`, so what lands in the cloud is an AES-GCM envelope.

const syncLog = logStore.createLogger("sync");

export type SyncBackendId = "local" | "dropbox" | "gdrive";

const BACKEND_KEY = "contacts:sync:backend";
const DROPBOX_TOKENS_KEY = "contacts:sync:dropbox";
const GDRIVE_TOKEN_KEY = "contacts:sync:gdrive";
const ENCRYPTED_KEY = "contacts:sync:encrypted";

const SAVE_DEBOUNCE_MS = 1200;

// OAuth app identities, injected at build time. Without them the matching
// backend's Connect button explains what to configure instead of failing.
export const DROPBOX_APP_KEY: string =
  (import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined) ?? "";
export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

// Dropbox fixes the app-folder name from the app's own configuration (an
// "App folder"-scoped app lives under `Apps/<name>/`), so it isn't always
// "Contacts". Inject the real name at build time so the "Open in Dropbox" link
// and the displayed file location point at the folder that actually exists;
// fall back to "Contacts" when unset.
export const DROPBOX_APP_FOLDER: string =
  (import.meta.env.VITE_DROPBOX_APP_FOLDER as string | undefined)?.trim() ||
  "Contacts";

// Google Drive's folder, unlike Dropbox's, is created by us — this name is the
// `Contacts` folder we make in the user's My Drive. It's build-time
// configurable so a deployment can file documents under its own folder name
// (and the "Open in Google Drive" search / displayed location follow suit);
// changing it points a fresh build at a differently-named folder. Defaults to
// "Contacts".
export const GDRIVE_APP_FOLDER: string =
  (import.meta.env.VITE_GDRIVE_APP_FOLDER as string | undefined)?.trim() ||
  "Contacts";

/** The mutable in-memory box the session passphrase lives in. Structurally
 *  satisfies the framework's read-only `PasswordRef`, while the app's unlock
 *  and setup flows can write to it. */
export type MutablePasswordRef = { current: string | null };

export const PROVIDER_NAMES: Record<Exclude<SyncBackendId, "local">, string> = {
  dropbox: "Dropbox",
  gdrive: "Google Drive",
};

type DropboxTokens = { accessToken: string; refreshToken: string | null };

/** The connect-time replace-or-adopt prompt's inputs: which provider was just
 *  connected, and a count of what each side holds so the user can tell them
 *  apart. The raw cloud bytes ride along so "use the cloud copy" can adopt them
 *  without a second round-trip. */
export type PendingCloudSetup = {
  provider: string;
  /** The existing cloud document's bytes, ready to adopt. */
  remoteText: string;
  /** What the cloud copy holds. */
  cloud: CloudDocSummary;
  /** What this device holds right now. */
  local: CloudDocSummary;
};

function readBackend(): SyncBackendId {
  const raw = localStorage.getItem(BACKEND_KEY);
  return raw === "dropbox" || raw === "gdrive" ? raw : "local";
}

function readDropboxTokens(): DropboxTokens | null {
  try {
    const raw = localStorage.getItem(DROPBOX_TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DropboxTokens;
    return typeof parsed.accessToken === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeDropboxTokens(tokens: DropboxTokens | null): void {
  if (tokens) {
    localStorage.setItem(DROPBOX_TOKENS_KEY, JSON.stringify(tokens));
  } else {
    localStorage.removeItem(DROPBOX_TOKENS_KEY);
  }
}

/** The document's file name on a cloud backend, one per namespace. */
export function cloudFileName(slug: string): string {
  return `contacts-${slug}.json`;
}

/** The document's human-readable location on the active cloud backend — the
 *  `Apps/<folder>` app folder on Dropbox, the `<folder>` My Drive folder on
 *  Google Drive. Shown under "File location" in the command centre. */
function backendPath(backend: SyncBackendId, slug: string): string {
  const file = cloudFileName(slug);
  if (backend === "dropbox") return `Apps/${DROPBOX_APP_FOLDER}/${file}`;
  if (backend === "gdrive") return `${GDRIVE_APP_FOLDER}/${file}`;
  return file;
}

/** A web URL that opens the active backend's storage in a browser tab so the
 *  user can see the synced files, or null when there's nothing to open (the
 *  on-device localStorage copy). Drives the command centre's "Open in {name}"
 *  link. Encryption doesn't change this — the envelope is still a real file. */
function backendWebUrl(backend: SyncBackendId, slug: string): string | null {
  if (backend === "dropbox") {
    return `https://www.dropbox.com/home/Apps/${encodeURIComponent(
      DROPBOX_APP_FOLDER,
    )}`;
  }
  if (backend === "gdrive") {
    // The document lives in the My Drive folder above; a filename search opens
    // Drive straight onto it without our having to resolve the folder id.
    return `https://drive.google.com/drive/search?q=${encodeURIComponent(
      cloudFileName(slug),
    )}`;
  }
  return null;
}

export type SyncEngine = {
  backend: SyncBackendId;
  /** Whether the active cloud backend has credentials. Always true for local. */
  connected: boolean;
  encrypted: boolean;
  setEncrypted: (v: boolean) => void;
  /** True when the cloud copy is an envelope and no passphrase is in memory. */
  locked: boolean;
  /** Set when a just-connected cloud backend already holds contacts that
   *  differ from this device's — the app raises the replace-or-adopt prompt.
   *  Null the rest of the time. Auto-save is held while it stands. */
  pendingSetup: PendingCloudSetup | null;
  /** Resolve the connect-time prompt: `"cloud"` adopts the existing cloud copy,
   *  `"replace"` keeps this device's copy and overwrites the cloud. */
  resolveSetup: (choice: "cloud" | "replace") => void;
  /** Try a passphrase against the encrypted cloud copy. Throws (and drops the
   *  passphrase again) when it doesn't decrypt — the unlock gate surfaces it. */
  unlock: (password: string) => Promise<void>;
  // Connect flows (the Storage settings tab drives these).
  connectDropbox: () => Promise<void>;
  connectGdrive: () => Promise<void>;
  disconnect: () => void;
  // The inputs the framework `SyncStatus` / `SyncDetailsModal` render over.
  status: SaveStatus;
  dirty: boolean;
  offline: boolean;
  providerName: string;
  backendKind: BackendKind;
  location: SyncLocation;
  // The action handlers the modal calls back.
  saveNow: () => void;
  reload: () => void;
  reconnect: (() => Promise<void>) | null;
  checkConnection: () => Promise<ConnectionProbeResult>;
};

export function useSyncEngine(
  store: ContactStore,
  slug: string,
  passwordRef: MutablePasswordRef,
  // Suspend all writes to the backend. Set while the developer "Fake data"
  // backend has taken over storage, so a throwaway sample is never pushed up to
  // a connected cloud copy — fake data stays entirely in memory.
  paused = false,
): SyncEngine {
  const [backend, setBackendState] = useState<SyncBackendId>(readBackend);
  const [dropboxTokens, setDropboxTokens] = useState<DropboxTokens | null>(
    readDropboxTokens,
  );
  const [gdriveToken, setGdriveToken] = useState<string | null>(() =>
    sessionStorage.getItem(GDRIVE_TOKEN_KEY),
  );
  const [encrypted, setEncryptedState] = useState<boolean>(
    () => localStorage.getItem(ENCRYPTED_KEY) === "1",
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "saved",
  );
  const [fault, setFault] = useState<
    "none" | "offline" | "auth-error" | "conflict" | "throttled" | "error"
  >("none");
  const [locked, setLocked] = useState(false);
  // Set when a fresh cloud connect finds the backend already holds differing
  // contacts — the replace-or-adopt prompt's inputs. Auto-save is held while it
  // stands so an edit can't overwrite the cloud copy before the user chooses.
  const [pendingSetup, setPendingSetup] = useState<PendingCloudSetup | null>(
    null,
  );
  // Mirror of `pendingSetup` readable synchronously from `doSave` — so
  // resolving to "replace" can clear the hold and push in the same tick without
  // waiting for the state-driven re-render.
  const pendingSetupRef = useRef<PendingCloudSetup | null>(null);
  pendingSetupRef.current = pendingSetup;
  // Marks the next adapter adoption as a fresh user-initiated connect (rather
  // than a reboot / namespace switch / unlock), so only *that* baseline read
  // raises the setup prompt. A ref, not state: it's set inside the connect
  // paths and read once by the baseline effect that the same connect triggers.
  const justConnected = useRef(false);
  // Set when a loaded cloud copy still holds inline photos (a pre-file-layout
  // document): a one-time save then files them out — see the sweep effect below.
  const [photoSweep, setPhotoSweep] = useState(false);
  // The edit counter that has been pushed to the backend. Anything newer is
  // unsaved — that's `dirty`.
  const [savedVersion, setSavedVersion] = useState(store.version);

  // Keep the live edit counter and document reachable from inside async saves
  // without making the debounce depend on them.
  const versionRef = useRef(store.version);
  versionRef.current = store.version;
  const dataRef = useRef(store.data);
  dataRef.current = store.data;
  // The backend revision the last load/save observed — handed back on the next
  // save so the adapter can detect another device's write (ConflictError).
  const baseRevision = useRef<string | undefined>(undefined);

  const isCloud = backend !== "local";
  const connected =
    backend === "local" ||
    (backend === "dropbox" && dropboxTokens !== null) ||
    (backend === "gdrive" && gdriveToken !== null);

  // The storage adapter for the active cloud backend, wrapped so the cloud
  // copy is readable offline (`withLocalCache`) and — when the user opted in —
  // encrypted at the byte boundary (`withEncryption`).
  const adapter: StorageAdapter | null = useMemo(() => {
    if (backend === "dropbox" && dropboxTokens) {
      const dropboxAuth = {
        accessToken: dropboxTokens.accessToken,
        refreshToken: dropboxTokens.refreshToken,
        onAccessTokenRefreshed: (accessToken: string) => {
          const next = { ...dropboxTokens, accessToken };
          writeDropboxTokens(next);
          setDropboxTokens(next);
        },
      };
      const cloud = createDropboxAdapter(dropboxAuth, {
        appKey: DROPBOX_APP_KEY || undefined,
        fileName: cloudFileName(slug),
        logger: logStore.createLogger("dropbox"),
      });
      const cached = withLocalCache(cloud, {
        storage: localStorage,
        key: localCacheKey("dropbox", slug),
      });
      // Encrypted: keep photos and attachments inside the AES-GCM envelope.
      // Plaintext: file each contact's photo originals out to `photos/…` and its
      // attachments out to `attachments/…` in the Dropbox app folder (see
      // `photoStore.ts` / `attachmentStore.ts`). The two externalisers compose —
      // they touch disjoint document fields.
      return encrypted
        ? withEncryption(cached, passwordRef, {
            logger: logStore.createLogger("encrypt"),
          })
        : withExternalAttachments(
            withExternalPhotos(
              cached,
              dropboxPhotoStore(dropboxAuth, DROPBOX_APP_KEY || undefined),
              () => setPhotoSweep(true),
            ),
            dropboxAttachmentStore(dropboxAuth, DROPBOX_APP_KEY || undefined),
          );
    }
    if (backend === "gdrive" && gdriveToken) {
      const cloud = createGdriveAdapter(gdriveToken, {
        appFolderName: GDRIVE_APP_FOLDER,
        fileName: cloudFileName(slug),
        logger: logStore.createLogger("gdrive"),
      });
      const cached = withLocalCache(cloud, {
        storage: localStorage,
        key: localCacheKey("gdrive", slug),
      });
      return encrypted
        ? withEncryption(cached, passwordRef, {
            logger: logStore.createLogger("encrypt"),
          })
        : withExternalAttachments(
            withExternalPhotos(cached, gdrivePhotoStore(gdriveToken), () =>
              setPhotoSweep(true),
            ),
            gdriveAttachmentStore(gdriveToken),
          );
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, dropboxTokens, gdriveToken, encrypted, slug]);

  // Complete a Dropbox OAuth redirect: trade the `?code=` for tokens, persist
  // them, and adopt the backend. Runs once on boot when a flow is mid-flight.
  useEffect(() => {
    if (!DROPBOX_APP_KEY || !hasPendingDropboxAuth()) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    void (async () => {
      try {
        const result = await completeDropboxAuth(DROPBOX_APP_KEY, code);
        const tokens: DropboxTokens = {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? null,
        };
        writeDropboxTokens(tokens);
        // Mark this adapter adoption as a fresh connect so the baseline read
        // raises the replace-or-adopt prompt if the backend already holds data.
        justConnected.current = true;
        setDropboxTokens(tokens);
        localStorage.setItem(BACKEND_KEY, "dropbox");
        setBackendState("dropbox");
        syncLog.info("dropbox: connected");
      } catch (err) {
        syncLog.error(
          `dropbox: connect failed — ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        // Drop the ?code= from the address bar either way.
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState(null, "", url.toString());
      }
    })();
  }, []);

  // On adopting an adapter (connect, namespace switch, unlock), read the
  // backend copy once to learn its revision — so the first push can detect a
  // conflict instead of clobbering another device's write. A remote copy that
  // exists is NOT auto-adopted; the local document stays the working copy and
  // "Reload from the backend" pulls it explicitly.
  useEffect(() => {
    if (!adapter) return;
    let cancelled = false;
    // Consume the fresh-connect marker: only a baseline read triggered by the
    // user just connecting gets to raise the replace-or-adopt prompt.
    const fresh = justConnected.current;
    justConnected.current = false;
    void (async () => {
      try {
        const snap = await adapter.load();
        if (cancelled) return;
        baseRevision.current = snap?.revision;
        setLocked(false);
        // A fresh connect onto a backend that already holds contacts differing
        // from this device's: don't silently pick a side — surface the choice.
        const remote =
          fresh && snap ? evaluateCloudSetup(snap.text, dataRef.current) : null;
        if (remote) {
          setPendingSetup({
            provider:
              PROVIDER_NAMES[backend as Exclude<SyncBackendId, "local">],
            remoteText: snap!.text,
            cloud: summarizeDoc(remote),
            local: summarizeDoc(dataRef.current),
          });
          syncLog.info(
            `setup: cloud holds ${remote.contacts.length} contact(s) — asking replace-or-adopt`,
          );
        }
        syncLog.info(
          snap
            ? `baseline: backend holds ${snap.text.length} B (rev ${snap.revision ?? "n/a"})`
            : "baseline: backend holds no document yet",
        );
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthError) setFault("auth-error");
        else if (encrypted && passwordRef.current === null) setLocked(true);
        else {
          syncLog.warn(
            `baseline: load failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  const dirty = isCloud && connected && store.version !== savedVersion;
  const blocked =
    fault === "offline" || fault === "auth-error" || fault === "conflict";

  // The save path: serialize the live document and push it through the
  // adapter, riding the framework's retry policy for transient failures. The
  // typed errors map onto the command centre's recovery affordances.
  const saving = useRef(false);
  const doSave = useCallback(async () => {
    // Fake-data takeover in effect — never push the in-memory sample upstream.
    if (paused) return;
    // A connect-time replace-or-adopt choice is pending — hold the write until
    // the user decides, so an edit can't overwrite the cloud copy first.
    if (pendingSetupRef.current) return;
    if (!adapter || saving.current) return;
    if (encrypted && passwordRef.current === null) {
      setLocked(true);
      return;
    }
    saving.current = true;
    setSaveState("saving");
    const version = versionRef.current;
    const text = serializeDoc(dataRef.current);
    try {
      for (let attempt = 0; ;) {
        try {
          const saved = await adapter.save(text, baseRevision.current);
          baseRevision.current = saved.revision;
          setSavedVersion(version);
          setSaveState("saved");
          setFault("none");
          syncLog.info(`save: ok (${text.length} B)`);
          return;
        } catch (err) {
          if (err instanceof ConflictError) {
            // The backend moved under us — surface it; "Reload from the
            // backend" adopts the newer copy.
            baseRevision.current = err.remote.revision;
            setFault("conflict");
            setSaveState("idle");
            syncLog.warn("save: conflict — a newer copy exists on the backend");
            return;
          }
          if (err instanceof AuthError) {
            setFault("auth-error");
            setSaveState("idle");
            syncLog.warn("save: session expired — reconnect required");
            return;
          }
          if (err instanceof RateLimitError) {
            setFault("throttled");
            const delay = err.retryAfterMs ?? backoffDelayMs(attempt);
            syncLog.warn(`save: rate limited — retrying in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
            attempt += 1;
            setFault("none");
            continue;
          }
          if (isRetryableSaveError(err) && attempt < 5) {
            const delay = backoffDelayMs(attempt);
            syncLog.warn(
              `save: transient failure — retry ${attempt + 1} in ${delay}ms`,
            );
            await new Promise((r) => setTimeout(r, delay));
            attempt += 1;
            continue;
          }
          setFault(navigator.onLine === false ? "offline" : "error");
          setSaveState("idle");
          syncLog.error(
            `save: failed — ${err instanceof Error ? err.message : String(err)}`,
          );
          return;
        }
      }
    } finally {
      saving.current = false;
    }
  }, [adapter, encrypted, passwordRef, paused]);

  // Debounced auto-save: a settled edit on a connected cloud backend pushes
  // itself, unless a blocking fault stands in the way.
  useEffect(() => {
    if (!isCloud || !connected || !adapter || !dirty || blocked || locked)
      return;
    // Hold auto-save while the connect-time prompt is open.
    if (pendingSetup) return;
    const timer = window.setTimeout(() => void doSave(), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    isCloud,
    connected,
    adapter,
    dirty,
    blocked,
    locked,
    pendingSetup,
    store.version,
    doSave,
  ]);

  // One-time photo sweep: when the adopted cloud copy still holds inline photos
  // (a document from before the file layout), file them out on open instead of
  // waiting for the next edit. `doSave` pushes the current document through the
  // externaliser, which writes the image files and strips the bytes; the flag
  // clears once fired so it runs at most once per adopted backend. Stays put
  // while a fault, lock, or fake-data pause blocks saving, then fires when clear.
  useEffect(() => {
    if (!photoSweep) return;
    if (!isCloud || !connected || !adapter || blocked || locked || paused)
      return;
    // Hold the sweep while the connect-time prompt is open — resolving it
    // pushes (replace) or adopts (cloud), which settles the photos either way.
    if (pendingSetup) return;
    if (encrypted && passwordRef.current === null) return;
    setPhotoSweep(false);
    syncLog.info("photos: cloud copy holds inline photos — filing them out");
    void doSave();
  }, [
    photoSweep,
    isCloud,
    connected,
    adapter,
    blocked,
    locked,
    paused,
    pendingSetup,
    encrypted,
    passwordRef,
    doSave,
  ]);

  // Map the engine's internal pieces onto the framework's `SaveStatus`.
  const status: SaveStatus =
    !isCloud || !connected
      ? "saved"
      : fault === "auth-error"
        ? "auth-error"
        : fault === "conflict"
          ? "conflict"
          : fault === "throttled"
            ? "throttled"
            : fault === "error"
              ? "error"
              : saveState === "saving"
                ? "saving"
                : dirty
                  ? "idle"
                  : "saved";

  const setBackend = useCallback(
    (b: SyncBackendId) => {
      localStorage.setItem(BACKEND_KEY, b);
      // Adopt the backend "in sync": the current document is the baseline, so
      // the glyph starts green rather than flagging everything as unsaved.
      setSavedVersion(store.version);
      setSaveState("saved");
      setFault("none");
      // A backend switch retires any open connect-time prompt.
      setPendingSetup(null);
      setBackendState(b);
    },
    [store.version],
  );

  const connectDropbox = useCallback(async () => {
    if (!DROPBOX_APP_KEY) return;
    syncLog.info("dropbox: starting OAuth…");
    await startDropboxAuth(DROPBOX_APP_KEY); // redirects away
  }, []);

  const connectGdrive = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    syncLog.info("gdrive: requesting consent…");
    const token = await startGdriveAuth(
      GOOGLE_CLIENT_ID,
      logStore.createLogger("gdrive"),
    );
    sessionStorage.setItem(GDRIVE_TOKEN_KEY, token);
    // Mark this adapter adoption as a fresh connect so the baseline read raises
    // the replace-or-adopt prompt if the backend already holds data.
    justConnected.current = true;
    setGdriveToken(token);
    setBackend("gdrive");
    syncLog.info("gdrive: connected");
  }, [setBackend]);

  const disconnect = useCallback(() => {
    writeDropboxTokens(null);
    sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
    setDropboxTokens(null);
    setGdriveToken(null);
    baseRevision.current = undefined;
    setBackend("local");
    syncLog.info("backend: back to this device only");
  }, [setBackend]);

  const setEncrypted = useCallback((v: boolean) => {
    localStorage.setItem(ENCRYPTED_KEY, v ? "1" : "0");
    setEncryptedState(v);
  }, []);

  const saveNow = useCallback(() => {
    if (!isCloud || !connected || blocked) return;
    void doSave();
  }, [isCloud, connected, blocked, doSave]);

  // Pull the backend copy down and adopt it as the working document — the
  // command centre's "Reload from the backend" (and the conflict resolution).
  const reload = useCallback(() => {
    if (!adapter) {
      store.reload();
      return;
    }
    void (async () => {
      try {
        const snap = await adapter.load();
        if (snap) {
          baseRevision.current = snap.revision;
          store.adoptRemote(snap.text);
          // `adoptRemote` bumps the edit counter exactly once; the adopted
          // copy IS the backend copy, so baseline dirty away.
          setSavedVersion(versionRef.current + 1);
          setFault("none");
          setSaveState("saved");
          syncLog.info(`reload: adopted backend copy (${snap.text.length} B)`);
        } else {
          syncLog.info("reload: backend holds no document yet");
        }
      } catch (err) {
        if (err instanceof AuthError) setFault("auth-error");
        else if (encrypted && passwordRef.current === null) setLocked(true);
        else {
          syncLog.error(
            `reload: failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    })();
  }, [adapter, store, encrypted, passwordRef]);

  // Resolve the connect-time replace-or-adopt prompt. "cloud" adopts the
  // existing cloud copy as the working document (the local copy steps aside);
  // "replace" keeps this device's copy and pushes it, overwriting the cloud.
  // Either way the baseline revision is already the cloud's (the baseline read
  // set it), so an adopt writes nothing and a replace is accepted.
  const resolveSetup = useCallback(
    (choice: "cloud" | "replace") => {
      const pending = pendingSetupRef.current;
      if (!pending) return;
      // Clear the hold before pushing so `doSave` isn't blocked by it.
      pendingSetupRef.current = null;
      setPendingSetup(null);
      if (choice === "cloud") {
        store.adoptRemote(pending.remoteText);
        // `adoptRemote` bumps the edit counter once; the adopted copy IS the
        // cloud copy, so baseline the dirty flag away.
        setSavedVersion(versionRef.current + 1);
        setFault("none");
        setSaveState("saved");
        syncLog.info("setup: adopted the existing cloud copy");
      } else {
        syncLog.info("setup: replacing the cloud copy with this device");
        void doSave();
      }
    },
    [store, doSave],
  );

  // Try a passphrase against the encrypted cloud copy — the unlock gate's
  // callback. A wrong passphrase fails at the AES-GCM auth tag; rethrow so the
  // gate surfaces it, and drop the passphrase so the next attempt re-derives.
  const unlock = useCallback(
    async (password: string) => {
      if (!adapter) return;
      passwordRef.current = password;
      try {
        const snap = await adapter.load();
        baseRevision.current = snap?.revision;
        setLocked(false);
        setFault("none");
        syncLog.info("unlock: cloud copy decrypted");
      } catch (err) {
        passwordRef.current = null;
        throw err;
      }
    },
    [adapter, passwordRef],
  );

  // Re-run the backend's consent flow — the command centre's "Reconnect".
  const reconnect = useCallback(async () => {
    if (backend === "dropbox") await connectDropbox();
    else if (backend === "gdrive") await connectGdrive();
    setFault("none");
  }, [backend, connectDropbox, connectGdrive]);

  const checkConnection =
    useCallback(async (): Promise<ConnectionProbeResult> => {
      if (!adapter) return "online";
      syncLog.info("probe: checking backend reachability…");
      try {
        const ok = adapter.probe ? await adapter.probe() : true;
        if (ok) {
          setFault((f) => (f === "offline" || f === "error" ? "none" : f));
          syncLog.info("probe: online");
          return "online";
        }
        syncLog.warn("probe: still offline");
        return "offline";
      } catch (err) {
        if (err instanceof AuthError) {
          setFault("auth-error");
          syncLog.warn("probe: session expired");
          return "auth-error";
        }
        syncLog.warn("probe: still offline");
        return "offline";
      }
    }, [adapter]);

  const providerName = isCloud
    ? PROVIDER_NAMES[backend as Exclude<SyncBackendId, "local">]
    : "This device";

  return {
    backend,
    connected,
    encrypted,
    setEncrypted,
    locked,
    pendingSetup,
    resolveSetup,
    unlock,
    connectDropbox,
    connectGdrive,
    disconnect,
    status,
    dirty,
    offline: fault === "offline",
    providerName,
    backendKind: isCloud ? "cloud" : "folder",
    location: {
      path: isCloud ? backendPath(backend, slug) : docKey(slug),
      url: isCloud && connected ? backendWebUrl(backend, slug) : null,
    },
    saveNow,
    reload,
    reconnect: isCloud && connected ? reconnect : null,
    checkConnection,
  };
}
