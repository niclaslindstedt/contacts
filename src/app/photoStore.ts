// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Externalise contact photos to real binary JPEG files on a cloud backend — the
// app's take on the `notes` attachment pattern, adapted to this app's
// single-document, framework-adapter architecture.
//
// The always-present localStorage working copy (`useContactStore`) keeps every
// photo inline as a data URI, so offline rendering and the local backend are
// untouched. This layer sits only on the *cloud* push/pull: `withExternalPhotos`
// wraps a `StorageAdapter` so that, on save, every image in each contact's photo
// gallery — the display crop (`photo`) and the larger original (`photoSource`)
// of each entry — is decoded to bytes and written to a deterministic file
// (`photos/<name>-<contactId>-<photoId>.jpg` and `…-source.jpg`, see
// `photoPathFor` / `photoSourcePathFor`) and stripped from the synced JSON — so
// the document carries no image data at all and the files are genuine,
// previewable JPEGs — and, on load, re-hydrated back onto each gallery entry
// from those files. A photo that arrives inline on an imported vCard rides the
// same seam: it lands in a gallery entry's `photo`, so the next cloud save files
// it out.
//
// The `data:` URL ⇄ bytes conversion (see `photo.ts`) is what keeps the drive
// copy binary; the byte-level transport is `photoFileStore.ts`.
//
// Because the paths are deterministic, the layout is also self-*healing*: on
// load a reconcile pass lists the `photos/` tree and, for any file the document
// doesn't already reference, parses its name back to the contact + photo it
// belongs to (`parsePhotoPath`) and re-attaches it to that card. So a photo
// whose gallery reference was lost is found and re-indexed, and a photo a user
// hand-drops into the drive under the right `…-<contactId>-<photoId>.jpg` name
// is adopted onto the matching contact — no edit needed.
//
// Two safety rules make it robust against an untested network:
//   1. **Externalise-or-embed** — an image is only stripped from the outgoing
//      document *after* its file write succeeds. A failed write leaves the photo
//      inline, so a photo is never lost, only un-filed.
//   2. **Prune after commit** — orphaned photo files are removed only once the
//      document save has committed, so a save that throws (e.g. a conflict)
//      never deletes a file the surviving remote copy still references. The
//      reconcile pass runs on load *before* any save, so a re-indexed or
//      hand-dropped file is referenced by the document before prune could ever
//      see it as an orphan.
//
// Encrypted documents skip this layer entirely (they keep photos inside the
// AES-GCM envelope rather than leak plaintext image files onto the drive), so
// the wrapper is composed only for the plaintext cloud path in `useSyncEngine`.

import {
  bytesToDataUrl,
  dataUrlToBytes,
} from "@niclaslindstedt/oss-framework/files";
import {
  type DropboxAuth,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

import { logStore } from "./log.ts";
import { parsePhotoPath } from "./photo.ts";
import { photoPathFor, photoSourcePathFor } from "./photo.ts";
import {
  dropboxPhotoFileStore,
  gdrivePhotoFileStore,
  type PhotoFileStore,
} from "./photoFileStore.ts";
import { folderFileStore } from "./folderFileStore.ts";

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

/** The local-folder photo store, filing binary JPEGs to `photos/…` inside the
 *  picked directory. `onPermissionLost` fires when a revoked OS grant is hit. */
export function folderPhotoStore(
  root: FileSystemDirectoryHandle,
  onPermissionLost?: () => void,
): PhotoStore {
  return scopeToPhotos(folderFileStore(root, onPermissionLost));
}

// -- the document shape this layer touches (a loose view of `AppData`) --------

/** One gallery photo, as this layer sees it — just the id, the two data-URI
 *  fields it files out, and the paths they map to. */
type PhotoEntry = {
  id: string;
  photo?: string | null;
  photoSource?: string | null;
  photoPath?: string | null;
  photoSourcePath?: string | null;
};
type PhotoContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  photos?: PhotoEntry[];
};
type PhotoDoc = { contacts?: PhotoContact[] };

/** The naming a deterministic photo path is built from — the contact's identity
 *  plus the photo's own id, since one card can carry several photos. */
type PhotoNamed = PhotoContact & { photoId: string };

/** One externalisable image on a gallery photo: the data-URI field to file out,
 *  the deterministic path builder, and the doc field the path maps to. */
type Slot = {
  data: "photo" | "photoSource";
  path: "photoPath" | "photoSourcePath";
  pathFor: (c: PhotoNamed) => string;
};

const SLOTS: Slot[] = [
  {
    data: "photo",
    path: "photoPath",
    pathFor: (c) => photoPathFor(c, c.photoId),
  },
  {
    data: "photoSource",
    path: "photoSourcePath",
    pathFor: (c) => photoSourcePathFor(c, c.photoId),
  },
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
  return contacts.some((c) =>
    (c.photos ?? []).some(
      (p) =>
        dataUrlToBytes(p.photo) !== null ||
        dataUrlToBytes(p.photoSource) !== null,
    ),
  );
}

/** Wrap a `StorageAdapter` so contact photos are externalised to binary JPEG
 *  files on save and re-hydrated on load. Delegates every other adapter member
 *  (id, label, capabilities, probe, …) to `inner`.
 *
 *  `onPhotosNeedResave` fires when a *loaded* backend copy needs filing out into
 *  the deterministic layout — either because it still holds inline image bytes
 *  (a pre-file-layout document, see {@link hasInlinePhotos}) or because the
 *  reconcile pass re-indexed a photo file the document hadn't referenced (a lost
 *  or hand-dropped photo). The sync engine uses it to kick a one-time save, so
 *  the document converges on the file layout — and persists the re-indexed
 *  references — without waiting for the next edit. */
export function withExternalPhotos(
  inner: StorageAdapter,
  photos: PhotoStore,
  onPhotosNeedResave?: () => void,
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
      for (const entry of c.photos ?? []) {
        const named: PhotoNamed = { ...c, photoId: entry.id };
        for (const slot of SLOTS) {
          const inline = entry[slot.data];
          if (inline) {
            const path = slot.pathFor(named);
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
              entry[slot.path] = path;
              delete entry[slot.data]; // stripped on success only
              desired.add(path);
            } catch (err) {
              // Externalise-or-embed: keep the image inline so it still syncs.
              log.warn(
                `could not externalise ${path} — keeping it inline (${errMsg(err)})`,
              );
            }
          } else if (entry[slot.path]) {
            // Already filed (rehydrated then left unchanged, or arrived from a
            // remote copy) — keep its file.
            desired.add(entry[slot.path]!);
          }
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

  // Load side: adopt filed photos the document doesn't yet reference — a photo
  // whose gallery reference was lost, or one a user hand-dropped into the
  // `photos/` tree under the right name — by re-attaching each to the contact
  // its filename names. Mutates `doc` in place; returns whether anything was
  // re-indexed. Runs before rehydrate (so the reclaimed paths get their bytes
  // read back like any other filed photo) and before the next save's prune (so
  // a reclaimed file is never mistaken for an orphan).
  async function reconcile(doc: PhotoDoc): Promise<boolean> {
    const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
    if (!contacts || contacts.length === 0) return false;

    let existing: string[];
    try {
      existing = await photos.list();
    } catch (err) {
      log.warn(`could not list photos to re-index (${errMsg(err)})`);
      return false;
    }
    if (existing.length === 0) return false;

    // Paths the document already accounts for — those need no re-indexing.
    const referenced = new Set<string>();
    const byId = new Map<string, PhotoContact>();
    for (const c of contacts) {
      byId.set(c.id, c);
      for (const entry of c.photos ?? []) {
        if (entry.photoPath) referenced.add(entry.photoPath);
        if (entry.photoSourcePath) referenced.add(entry.photoSourcePath);
      }
    }

    const unreferenced = existing.filter((p) => !referenced.has(p));
    if (unreferenced.length === 0) return false;
    // Log the shape of the reconcile so the Developer → Logs tab can show why a
    // photo did (or didn't) reconnect — the per-file lines below name the
    // contact each file claims, so a stale / renamed id is easy to spot.
    log.info(
      `reconcile: ${existing.length} photo file(s) on backend, ` +
        `${referenced.size} already referenced, ${unreferenced.length} ` +
        `unreferenced — checking against ${byId.size} contact(s)`,
    );

    let reindexed = 0;
    const unmatched: string[] = [];
    for (const path of unreferenced) {
      const parsed = parsePhotoPath(path, byId.keys());
      const contact = parsed ? byId.get(parsed.contactId) : undefined;
      if (!parsed || !contact) {
        unmatched.push(path);
        continue;
      }
      const gallery = (contact.photos ??= []);
      let entry = gallery.find((p) => p.id === parsed.photoId);
      if (!entry) {
        entry = { id: parsed.photoId };
        gallery.push(entry);
      }
      const field = parsed.source ? "photoSourcePath" : "photoPath";
      if (entry[field] !== path) {
        entry[field] = path;
        reindexed += 1;
        log.info(
          `re-indexed ${path} → contact ${parsed.contactId}` +
            (parsed.source ? " (source)" : ""),
        );
      }
    }
    for (const path of unmatched) {
      log.warn(`reconcile: no matching contact for ${path} — left unattached`);
    }
    log.info(
      `reconcile: re-indexed ${reindexed} file(s), ${unmatched.length} unmatched`,
    );
    return reindexed > 0;
  }

  // Parse → reconcile → re-serialise. Returns the (possibly rewritten) text and
  // whether any photo file was re-indexed onto a contact.
  async function reindex(
    text: string,
  ): Promise<{ text: string; changed: boolean }> {
    let doc: PhotoDoc;
    try {
      doc = JSON.parse(text) as PhotoDoc;
    } catch {
      return { text, changed: false };
    }
    const changed = await reconcile(doc);
    return { text: changed ? JSON.stringify(doc) : text, changed };
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
      contacts.flatMap((c) =>
        (c.photos ?? []).map(async (entry) => {
          for (const slot of SLOTS) {
            const path = entry[slot.path];
            if (path && !entry[slot.data]) {
              try {
                const bytes = await photos.read(path);
                if (bytes) {
                  const url = bytesToDataUrl("image/jpeg", bytes);
                  entry[slot.data] = url;
                  written.set(path, fingerprint(url));
                  changed = true;
                }
              } catch (err) {
                log.warn(`could not read ${path} (${errMsg(err)})`);
              }
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
      // Detect inline bytes on the raw stored text, before rehydration re-inlines
      // filed photos — so only a copy that genuinely still embeds bytes trips it.
      const inline = hasInlinePhotos(snap.text);
      // Re-index any filed photo the document doesn't reference (lost or
      // hand-dropped), then rehydrate reads the reclaimed paths' bytes too.
      const { text, changed } = await reindex(snap.text);
      if (onPhotosNeedResave && (inline || changed)) onPhotosNeedResave();
      return { ...snap, text: await rehydrate(text) };
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
