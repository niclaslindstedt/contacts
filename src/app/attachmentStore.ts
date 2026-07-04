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
// `write` there now carries a MIME type so a filed PDF lands as a PDF. The two
// safety rules match the photo layer: an attachment is stripped from the
// document only *after* its file write succeeds (never lost, only un-filed), and
// orphaned files are pruned only once the document save commits.
//
// Unlike photos there is no one-time "inline sweep": attachments are a new
// feature, so no pre-existing cloud copy embeds them — the first edit-triggered
// save files any new attachment out. Encrypted documents skip this layer
// entirely (they keep attachments inside the AES-GCM envelope), so the wrapper
// is composed only for the plaintext cloud path in `useSyncEngine`.

import {
  type DropboxAuth,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

import { exportFileStem } from "./export.ts";
import { logStore } from "./log.ts";
import { bytesToDataUrl, dataUrlToBytes } from "./photo.ts";
import {
  dropboxPhotoFileStore,
  gdrivePhotoFileStore,
  type PhotoFileStore,
} from "./photoFileStore.ts";
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

  async function externalise(
    text: string,
  ): Promise<{ text: string; desired: Set<string> }> {
    const desired = new Set<string>();
    let doc: AttachmentDoc;
    try {
      doc = JSON.parse(text) as AttachmentDoc;
    } catch {
      return { text, desired };
    }
    const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
    if (!contacts) return { text, desired };

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
    return { text: JSON.stringify(doc), desired };
  }

  async function prune(desired: Set<string>): Promise<void> {
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
    await Promise.all(
      orphans.map((p) =>
        attachments
          .remove(p)
          .then(() => written.delete(p))
          .catch((err: unknown) =>
            log.warn(`could not remove ${p} (${errMsg(err)})`),
          ),
      ),
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
    let changed = false;
    await Promise.all(
      contacts.flatMap((c) =>
        (c.attachments ?? []).map(async (entry) => {
          if (entry.dataPath && !entry.data) {
            try {
              const bytes = await attachments.read(entry.dataPath);
              if (bytes) {
                const url = bytesToDataUrl(
                  entry.mime || "application/octet-stream",
                  bytes,
                );
                entry.data = url;
                written.set(entry.dataPath, fingerprint(url));
                changed = true;
              }
            } catch (err) {
              log.warn(`could not read ${entry.dataPath} (${errMsg(err)})`);
            }
          }
        }),
      ),
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
