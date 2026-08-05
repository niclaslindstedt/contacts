// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Externalise contact attachments to real binary files on a cloud backend —
// the same seam photos use (`photoStore.ts`), adapted to arbitrary files.
//
// The always-present localStorage working copy keeps every attachment inline as
// a `data:` URI, so the local backend and offline rendering are untouched. This
// layer sits only on the *cloud* push/pull: `withExternalAttachments` wraps a
// `StorageAdapter` so that, on save, every attachment's bytes are decoded and
// written to a deterministic file (`attachments/<name>-<contactId>-<attachId>.<ext>`)
// and stripped from the synced JSON — so the document carries no file bytes and
// the drive holds genuine, previewable files (a `.pdf` is a PDF) — and, on load,
// re-hydrated back onto each attachment from those files, tagged with the
// attachment's own stored MIME type.
//
// It reuses the byte-level transport (`photoFileStore.ts`) the photos use — the
// `write` there now carries a MIME type so a filed PDF lands as a PDF, and every
// operation rides the shared media retry (`cloudRetry.ts`) so a throttle is
// waited out rather than reported as a broken file. The safety rules match the
// photo layer: an attachment is stripped from the document only *after* its file
// write succeeds (never lost, only un-filed); orphaned files are pruned only
// once the document save commits; and the prune is skipped entirely for a save
// that couldn't file everything out, since a desired set short of the truth
// would make good files look like orphans. Both sweeps are bounded rather than
// firing every file at the network in one tick.
//
// Unlike photos there is no one-time "inline sweep": attachments are a new
// feature, so no pre-existing cloud copy embeds them — the first edit-triggered
// save files any new attachment out. Encrypted documents skip this layer
// entirely (they keep attachments inside the AES-GCM envelope), so the wrapper
// is composed only for the plaintext cloud path in `useSyncEngine`.

import {
  bytesToDataUrl,
  dataUrlToBytes,
} from "@niclaslindstedt/oss-framework/files";
import {
  type DropboxAuth,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

import { MEDIA_CONCURRENCY, mapLimit } from "./cloudRetry.ts";
import { exportFileStem } from "./export.ts";
import { logStore } from "./log.ts";
import {
  dropboxPhotoFileStore,
  gdrivePhotoFileStore,
  type PhotoFileStore,
} from "./photoFileStore.ts";
import { folderFileStore } from "./folderFileStore.ts";
import type { Contact } from "./types.ts";

const log = logStore.createLogger("attachments");

/** The byte-level contract the externaliser needs — reuses the photos' binary
 *  transport, scoped to the `attachments/` tree. */
export type AttachmentStore = PhotoFileStore;

const ATTACH_ROOT = "attachments";

/** Scope a byte file store to the `attachments/` tree so `list` (used by the
 *  prune) only ever reports attachment files, never the document or the
 *  `photos/` tree. */
function scopeToAttachments(files: PhotoFileStore): AttachmentStore {
  return {
    async list() {
      const paths = await files.list();
      return paths.filter((p) => p.startsWith(`${ATTACH_ROOT}/`));
    },
    read: (path) => files.read(path),
    write: (path, bytes, mime) => files.write(path, bytes, mime),
    remove: (path) => files.remove(path),
  };
}

/** The Dropbox attachment store, rooted at the app folder. */
export function dropboxAttachmentStore(
  auth: DropboxAuth,
  appKey: string | undefined,
): AttachmentStore {
  return scopeToAttachments(dropboxPhotoFileStore(auth, appKey));
}

/** The Google Drive attachment store, in the app folder's `attachments/` tree. */
export function gdriveAttachmentStore(token: string): AttachmentStore {
  return scopeToAttachments(gdrivePhotoFileStore(token));
}

/** The local-folder attachment store, filing binary files to `attachments/…`
 *  inside the picked directory. `onPermissionLost` fires on a revoked grant. */
export function folderAttachmentStore(
  root: FileSystemDirectoryHandle,
  onPermissionLost?: () => void,
): AttachmentStore {
  return scopeToAttachments(folderFileStore(root, onPermissionLost));
}

// -- the document shape this layer touches (a loose view of `AppData`) --------

type AttachmentEntry = {
  id: string;
  name?: string;
  mime?: string;
  data?: string | null;
  dataPath?: string | null;
};
type AttachmentContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  attachments?: AttachmentEntry[];
};
type AttachmentDoc = { contacts?: AttachmentContact[] };

/** The file extension a filed attachment keeps, so what lands on the drive is a
 *  previewable `.pdf` / `.png` rather than an extension-less blob. Prefers the
 *  original file name's extension, else derives one from the MIME subtype. */
function extensionFor(
  name: string | undefined,
  mime: string | undefined,
): string {
  const fromName = /\.([a-z0-9]+)$/i.exec(name ?? "");
  if (fromName) return `.${fromName[1]!.toLowerCase()}`;
  const sub = (mime ?? "")
    .split("/")[1]
    ?.split(";")[0]
    ?.replace(/[^a-z0-9]/gi, "");
  return sub ? `.${sub.toLowerCase()}` : ".bin";
}

/** The deterministic file path an attachment's bytes are externalised to:
 *  `attachments/<name-slug>-<contactId>-<attachId>.<ext>`. Built from the
 *  display name (reusing the export filename slug), the stable contact id, and
 *  the attachment's own id, so it is deterministic and unique across name
 *  collisions and across the several files one card can carry. */
export function attachmentPathFor(
  contact: AttachmentContact,
  entry: AttachmentEntry,
): string {
  const stem = exportFileStem({
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    company: contact.company,
  } as Contact);
  return `${ATTACH_ROOT}/${stem}-${contact.id}-${entry.id}${extensionFor(
    entry.name,
    entry.mime,
  )}`;
}

/** A cheap 32-bit fingerprint (djb2) of an inline data URI, so an unchanged
 *  attachment isn't re-uploaded on every debounced save. */
function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i);
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

/** Wrap a `StorageAdapter` so contact attachments are externalised to binary
 *  files on save and re-hydrated on load. Delegates every other adapter member
 *  to `inner`. */
export function withExternalAttachments(
  inner: StorageAdapter,
  attachments: AttachmentStore,
): StorageAdapter {
  // Paths this session has already written, keyed to the source fingerprint, so
  // a debounced re-save doesn't re-upload unchanged bytes.
  const written = new Map<string, string>();

  // Returns the stripped text, the paths the document still wants, and whether
  // that set is a *complete* account of it — only a complete one may drive the
  // post-commit prune.
  async function externalise(text: string): Promise<{
    text: string;
    desired: Set<string>;
    complete: boolean;
  }> {
    const desired = new Set<string>();
    let doc: AttachmentDoc;
    try {
      doc = JSON.parse(text) as AttachmentDoc;
    } catch {
      // Nothing was understood, so nothing may be judged an orphan.
      return { text, desired, complete: false };
    }
    const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
    if (!contacts) return { text, desired, complete: false };
    let complete = true;

    for (const c of contacts) {
      for (const entry of c.attachments ?? []) {
        const inline = entry.data;
        if (inline) {
          const path = attachmentPathFor(c, entry);
          const bytes = dataUrlToBytes(inline);
          if (!bytes) {
            // Not a decodable data URI — leave it inline rather than lose it.
            continue;
          }
          const fp = fingerprint(inline);
          try {
            if (written.get(path) !== fp) {
              await attachments.write(
                path,
                bytes.bytes,
                entry.mime || bytes.mime,
              );
              written.set(path, fp);
              log.info(`externalised ${path}`);
            }
            entry.dataPath = path;
            delete entry.data; // stripped on success only
            desired.add(path);
          } catch (err) {
            // Externalise-or-embed: keep the bytes inline so they still sync.
            // The path stays *wanted* (a copy may already be filed there) and
            // the prune stands down, so a throttled upload can't delete the
            // file it failed to replace.
            desired.add(path);
            complete = false;
            log.warn(
              `could not externalise ${path} — keeping it inline (${errMsg(err)})`,
            );
          }
        } else if (entry.dataPath) {
          // Already filed (rehydrated then left unchanged, or from a remote
          // copy) — keep its file.
          desired.add(entry.dataPath);
        }
      }
    }
    return { text: JSON.stringify(doc), desired, complete };
  }

  async function prune(desired: Set<string>, complete: boolean): Promise<void> {
    if (!complete) {
      log.warn(
        "skipping the orphan prune — some attachments could not be filed " +
          "out, so a file this save didn't account for is not an orphan",
      );
      return;
    }
    let existing: string[];
    try {
      existing = await attachments.list();
    } catch (err) {
      log.warn(`could not list attachments to prune (${errMsg(err)})`);
      return;
    }
    const orphans = existing.filter((p) => !desired.has(p));
    if (orphans.length === 0) return;
    log.info(`pruning ${orphans.length} orphaned attachment file(s)`);
    await mapLimit(orphans, MEDIA_CONCURRENCY, (p) =>
      attachments
        .remove(p)
        .then(() => {
          written.delete(p);
        })
        .catch((err: unknown) => {
          log.warn(`could not remove ${p} (${errMsg(err)})`);
        }),
    );
  }

  async function rehydrate(text: string): Promise<string> {
    let doc: AttachmentDoc;
    try {
      doc = JSON.parse(text) as AttachmentDoc;
    } catch {
      return text;
    }
    const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
    if (!contacts) return text;
    // Flatten to one job per filed attachment so the whole load is what gets
    // rate-limited, a few files at a time, rather than each contact.
    const jobs = contacts.flatMap((c) =>
      (c.attachments ?? []).filter((entry) => entry.dataPath && !entry.data),
    );
    if (jobs.length === 0) return text;
    let changed = false;
    let missing = 0;
    await mapLimit(jobs, MEDIA_CONCURRENCY, async (entry) => {
      const path = entry.dataPath!;
      try {
        const bytes = await attachments.read(path);
        if (bytes) {
          const url = bytesToDataUrl(
            entry.mime || "application/octet-stream",
            bytes,
          );
          entry.data = url;
          written.set(path, fingerprint(url));
          changed = true;
        }
      } catch (err) {
        missing += 1;
        log.warn(`could not read ${path} (${errMsg(err)})`);
      }
    });
    if (missing > 0) {
      log.warn(
        `${missing} of ${jobs.length} attachment file(s) could not be read — ` +
          "the loaded copy is incomplete",
      );
    }
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
      const { text: stripped, desired, complete } = await externalise(text);
      const snap = await inner.save(stripped, baseRevision);
      await prune(desired, complete);
      return snap;
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
