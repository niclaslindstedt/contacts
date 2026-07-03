// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Externalise contact photos to real files on a cloud backend — the app's take
// on the `notes` attachment pattern, adapted to this app's single-document,
// framework-adapter architecture.
//
// The always-present localStorage working copy (`useContactStore`) keeps every
// photo inline as a data URI, so offline rendering and the local backend are
// untouched. This layer sits only on the *cloud* push/pull: `withExternalPhotos`
// wraps a `StorageAdapter` so that, on save, each contact's large original
// (`photoSource`) is written to a deterministic file (`photos/<name>-<id>.jpg`,
// see `photoPathFor`) and stripped from the synced JSON — keeping the document
// small and the photo easy to find in the drive — and, on load, re-hydrated
// back onto the contact from that file.
//
// Two safety rules make it robust against an untested network:
//   1. **Externalise-or-embed** — a contact's `photoSource` is only stripped
//      from the outgoing document *after* its file write succeeds. A failed
//      write leaves the photo inline, so a photo is never lost, only un-filed.
//   2. **Prune after commit** — orphaned photo files are removed only once the
//      document save has committed, so a save that throws (e.g. a conflict)
//      never deletes a file the surviving remote copy still references.
//
// Encrypted documents skip this layer entirely (they keep photos inside the
// AES-GCM envelope rather than leak plaintext image files onto the drive), so
// the wrapper is composed only for the plaintext cloud path in `useSyncEngine`.

import {
  createDropboxFileStore,
  createGdriveFileStore,
  type DropboxAuth,
  type FileStore,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

import { logStore } from "./log.ts";
import { photoPathFor } from "./photo.ts";

const log = logStore.createLogger("photos");

/** The small binary-ish contract the externaliser needs — every stored photo's
 *  path, plus read/write/remove of one photo's data URI. Built over a
 *  framework `FileStore` (see `createPhotoStore`), which stores the data URI as
 *  text; the app never needs raw bytes here because the data URI round-trips. */
export type PhotoStore = {
  list(): Promise<string[]>;
  read(path: string): Promise<string | null>;
  write(path: string, dataUrl: string): Promise<void>;
  remove(path: string): Promise<void>;
};

/** Build a `PhotoStore` over a framework `FileStore`, scoping it to the
 *  `photos/` tree at the backend's app-folder root. */
export function createPhotoStore(files: FileStore): PhotoStore {
  return {
    async list() {
      const entries = await files.list();
      return entries
        .map((e) => e.path)
        .filter((p) => p.startsWith(`${PHOTO_ROOT}/`));
    },
    read: (path) => files.read(path),
    write: (path, dataUrl) => files.write(path, dataUrl),
    remove: (path) => files.remove(path),
  };
}

const PHOTO_ROOT = "photos";

/** The Dropbox photo store, rooted at the app folder so paths read as
 *  `photos/<name>-<id>.jpg`. */
export function dropboxPhotoStore(
  auth: DropboxAuth,
  appKey: string | undefined,
): PhotoStore {
  return createPhotoStore(
    createDropboxFileStore(auth, {
      appKey,
      logger: logStore.createLogger("dropbox"),
    }),
  );
}

/** The Google Drive photo store, in the app folder's `photos/` tree. */
export function gdrivePhotoStore(token: string): PhotoStore {
  return createPhotoStore(
    createGdriveFileStore(token, {
      appFolderName: "Contacts",
      logger: logStore.createLogger("gdrive"),
    }),
  );
}

// -- the document shape this layer touches (a loose view of `AppData`) --------

type PhotoContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  photo?: string | null;
  photoSource?: string | null;
  photoPath?: string | null;
};
type PhotoDoc = { contacts?: PhotoContact[] };

/** A cheap 32-bit fingerprint (djb2) of a source data URI, so an unchanged
 *  photo isn't re-uploaded on every debounced save — only a genuinely new
 *  upload (different bytes) rewrites the file. */
function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i);
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

/** Wrap a `StorageAdapter` so contact photos are externalised to `photos`
 *  files on save and re-hydrated on load. Delegates every other adapter member
 *  (id, label, capabilities, probe, …) to `inner`. */
export function withExternalPhotos(
  inner: StorageAdapter,
  photos: PhotoStore,
): StorageAdapter {
  // Paths this session has already written, keyed to the source fingerprint, so
  // a re-crop (same original) or a debounced re-save doesn't re-upload.
  const written = new Map<string, string>();

  // Save side: write each contact's original to its file and strip it from the
  // outgoing JSON. Returns the stripped text and the set of paths the document
  // still wants (for the post-commit prune).
  async function externalise(
    text: string,
  ): Promise<{ text: string; desired: Set<string> }> {
    const desired = new Set<string>();
    let doc: PhotoDoc;
    try {
      doc = JSON.parse(text) as PhotoDoc;
    } catch {
      return { text, desired };
    }
    const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
    if (!contacts) return { text, desired };

    for (const c of contacts) {
      const source = c.photoSource;
      if (source) {
        const path = photoPathFor(c);
        const fp = fingerprint(source);
        try {
          if (written.get(path) !== fp) {
            await photos.write(path, source);
            written.set(path, fp);
            log.info(`externalised ${path}`);
          }
          c.photoPath = path;
          delete c.photoSource; // stripped from the cloud copy on success only
          desired.add(path);
        } catch (err) {
          // Externalise-or-embed: keep the photo inline so it still syncs.
          log.warn(
            `could not externalise ${path} — keeping it inline (${errMsg(err)})`,
          );
        }
      } else if (c.photoPath) {
        // Already filed (source was rehydrated then left unchanged, or arrived
        // from a remote copy) — keep its file.
        desired.add(c.photoPath);
      }
    }
    return { text: JSON.stringify(doc), desired };
  }

  // Remove photo files no surviving contact references. Best-effort and only
  // after the document save commits.
  async function prune(desired: Set<string>): Promise<void> {
    let existing: string[];
    try {
      existing = await photos.list();
    } catch (err) {
      log.warn(`could not list photos to prune (${errMsg(err)})`);
      return;
    }
    const orphans = existing.filter((p) => !desired.has(p));
    if (orphans.length === 0) return;
    log.info(`pruning ${orphans.length} orphaned photo file(s)`);
    await Promise.all(
      orphans.map((p) =>
        photos
          .remove(p)
          .then(() => written.delete(p))
          .catch((err: unknown) =>
            log.warn(`could not remove ${p} (${errMsg(err)})`),
          ),
      ),
    );
  }

  // Load side: fetch each filed photo back onto its contact.
  async function rehydrate(text: string): Promise<string> {
    let doc: PhotoDoc;
    try {
      doc = JSON.parse(text) as PhotoDoc;
    } catch {
      return text;
    }
    const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
    if (!contacts) return text;
    let changed = false;
    await Promise.all(
      contacts.map(async (c) => {
        if (c.photoPath && !c.photoSource) {
          try {
            const data = await photos.read(c.photoPath);
            if (data) {
              c.photoSource = data;
              written.set(c.photoPath, fingerprint(data));
              changed = true;
            }
          } catch (err) {
            log.warn(`could not read ${c.photoPath} (${errMsg(err)})`);
          }
        }
      }),
    );
    return changed ? JSON.stringify(doc) : text;
  }

  return {
    ...inner,
    async load() {
      const snap = await inner.load();
      if (!snap) return snap;
      return { ...snap, text: await rehydrate(snap.text) };
    },
    async save(text, baseRevision) {
      const { text: stripped, desired } = await externalise(text);
      const snap = await inner.save(stripped, baseRevision);
      await prune(desired);
      return snap;
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
