// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Externalise contact photos to real binary JPEG files on a cloud backend — the
// app's take on the `notes` attachment pattern, adapted to this app's
// single-document, framework-adapter architecture.
//
// The always-present localStorage working copy (`useContactStore`) keeps every
// photo inline as a data URI, so offline rendering and the local backend are
// untouched. This layer sits only on the *cloud* push/pull: `withExternalPhotos`
// wraps a `StorageAdapter` so that, on save, each contact's images — the display
// crop (`photo`) and the larger original (`photoSource`) — are decoded to bytes
// and written to deterministic files (`photos/<name>-<id>.jpg` and
// `…-source.jpg`, see `photoPathFor` / `photoSourcePathFor`) and stripped from
// the synced JSON — so the document carries no image data at all and the files
// are genuine, previewable JPEGs — and, on load, re-hydrated back onto the
// contact from those files. Photos that arrive inline on an imported vCard ride
// the same seam: they land in `photo`, so the next cloud save files them out.
//
// The `data:` URL ⇄ bytes conversion (see `photo.ts`) is what keeps the drive
// copy binary; the byte-level transport is `photoFileStore.ts`.
//
// Two safety rules make it robust against an untested network:
//   1. **Externalise-or-embed** — an image is only stripped from the outgoing
//      document *after* its file write succeeds. A failed write leaves the photo
//      inline, so a photo is never lost, only un-filed.
//   2. **Prune after commit** — orphaned photo files are removed only once the
//      document save has committed, so a save that throws (e.g. a conflict)
//      never deletes a file the surviving remote copy still references.
//
// Encrypted documents skip this layer entirely (they keep photos inside the
// AES-GCM envelope rather than leak plaintext image files onto the drive), so
// the wrapper is composed only for the plaintext cloud path in `useSyncEngine`.

import {
  type DropboxAuth,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

import { logStore } from "./log.ts";
import { bytesToDataUrl, dataUrlToBytes } from "./photo.ts";
import { photoPathFor, photoSourcePathFor } from "./photo.ts";
import {
  dropboxPhotoFileStore,
  gdrivePhotoFileStore,
  type PhotoFileStore,
} from "./photoFileStore.ts";

const log = logStore.createLogger("photos");

/** The byte-level contract the externaliser needs — every stored photo's path,
 *  plus read/write/remove of one photo's raw image bytes. Built over a
 *  {@link PhotoFileStore} so what lands on the drive is a real binary JPEG. */
export type PhotoStore = PhotoFileStore;

const PHOTO_ROOT = "photos";

/** Scope a byte file store to the `photos/` tree at the backend's app-folder
 *  root, so `list` only ever reports photo files (not the document itself). */
function scopeToPhotos(files: PhotoFileStore): PhotoStore {
  return {
    async list() {
      const paths = await files.list();
      return paths.filter((p) => p.startsWith(`${PHOTO_ROOT}/`));
    },
    read: (path) => files.read(path),
    write: (path, bytes) => files.write(path, bytes),
    remove: (path) => files.remove(path),
  };
}

/** The Dropbox photo store, rooted at the app folder so paths read as
 *  `photos/<name>-<id>.jpg`. */
export function dropboxPhotoStore(
  auth: DropboxAuth,
  appKey: string | undefined,
): PhotoStore {
  return scopeToPhotos(dropboxPhotoFileStore(auth, appKey));
}

/** The Google Drive photo store, in the app folder's `photos/` tree. */
export function gdrivePhotoStore(token: string): PhotoStore {
  return scopeToPhotos(gdrivePhotoFileStore(token));
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
  photoSourcePath?: string | null;
};
type PhotoDoc = { contacts?: PhotoContact[] };

/** One externalisable image on a contact: the data-URI field to file out, the
 *  deterministic path builder, and the doc fields it maps to. */
type Slot = {
  data: "photo" | "photoSource";
  path: "photoPath" | "photoSourcePath";
  pathFor: (c: PhotoContact) => string;
};

const SLOTS: Slot[] = [
  { data: "photo", path: "photoPath", pathFor: photoPathFor },
  { data: "photoSource", path: "photoSourcePath", pathFor: photoSourcePathFor },
];

/** A cheap 32-bit fingerprint (djb2) of a source data URI, so an unchanged
 *  photo isn't re-uploaded on every debounced save — only a genuinely new
 *  upload (different bytes) rewrites the file. */
function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i);
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

/** Whether a *stored* document still carries image bytes inline — a contact
 *  whose `photo` or `photoSource` is a decodable data URI. Run against the raw
 *  backend copy (before rehydration), it is the "this cloud copy predates the
 *  file layout and wants externalising" signal the one-time sweep keys off:
 *  a fully-filed copy has only paths, so it reads false. */
export function hasInlinePhotos(text: string): boolean {
  let doc: PhotoDoc;
  try {
    doc = JSON.parse(text) as PhotoDoc;
  } catch {
    return false;
  }
  const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
  if (!contacts) return false;
  return contacts.some(
    (c) =>
      dataUrlToBytes(c.photo) !== null ||
      dataUrlToBytes(c.photoSource) !== null,
  );
}

/** Wrap a `StorageAdapter` so contact photos are externalised to binary JPEG
 *  files on save and re-hydrated on load. Delegates every other adapter member
 *  (id, label, capabilities, probe, …) to `inner`.
 *
 *  `onInlinePhotosLoaded` fires when a *loaded* backend copy still holds inline
 *  image bytes (see {@link hasInlinePhotos}) — the sync engine uses it to kick a
 *  one-time save that files the photos out, so an existing document migrates to
 *  the file layout on open without waiting for the next edit. */
export function withExternalPhotos(
  inner: StorageAdapter,
  photos: PhotoStore,
  onInlinePhotosLoaded?: () => void,
): StorageAdapter {
  // Paths this session has already written, keyed to the source fingerprint, so
  // a re-crop (same original) or a debounced re-save doesn't re-upload.
  const written = new Map<string, string>();

  // Save side: write each contact's images to their files and strip them from
  // the outgoing JSON. Returns the stripped text and the set of paths the
  // document still wants (for the post-commit prune).
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
      for (const slot of SLOTS) {
        const inline = c[slot.data];
        if (inline) {
          const path = slot.pathFor(c);
          const bytes = dataUrlToBytes(inline);
          if (!bytes) {
            // Not a decodable data URI — leave it inline rather than lose it.
            continue;
          }
          const fp = fingerprint(inline);
          try {
            if (written.get(path) !== fp) {
              await photos.write(path, bytes.bytes);
              written.set(path, fp);
              log.info(`externalised ${path}`);
            }
            c[slot.path] = path;
            delete c[slot.data]; // stripped from the cloud copy on success only
            desired.add(path);
          } catch (err) {
            // Externalise-or-embed: keep the image inline so it still syncs.
            log.warn(
              `could not externalise ${path} — keeping it inline (${errMsg(err)})`,
            );
          }
        } else if (c[slot.path]) {
          // Already filed (rehydrated then left unchanged, or arrived from a
          // remote copy) — keep its file.
          desired.add(c[slot.path]!);
        }
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

  // Load side: fetch each filed image back onto its contact.
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
        for (const slot of SLOTS) {
          const path = c[slot.path];
          if (path && !c[slot.data]) {
            try {
              const bytes = await photos.read(path);
              if (bytes) {
                const url = bytesToDataUrl("image/jpeg", bytes);
                c[slot.data] = url;
                written.set(path, fingerprint(url));
                changed = true;
              }
            } catch (err) {
              log.warn(`could not read ${path} (${errMsg(err)})`);
            }
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
      // Detect on the raw stored text, before rehydration re-inlines filed
      // photos — so only a copy that genuinely still embeds bytes trips it.
      if (onInlinePhotosLoaded && hasInlinePhotos(snap.text)) {
        onInlinePhotosLoaded();
      }
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
