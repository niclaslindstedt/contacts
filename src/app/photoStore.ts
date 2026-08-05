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
// (`photos/<name>-<tag>-<index>.jpg` and `…-source.jpg`, see `photoPathFor` /
// `photoSourcePathFor`) and stripped from the synced JSON — so
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
// whose gallery reference was lost is found and re-indexed. A copy still filed
// under an older build's `…-<contactId>-<photoId>.jpg` naming (or a since-renamed
// contact) is re-filed into the current `…-<tag>-<index>.jpg` layout on the next
// save, and the stale file pruned — no edit needed.
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
//   3. **Only prune from a complete picture** — "orphan" means "no contact wants
//      this file", and that judgement is only sound when the outgoing document
//      was fully understood. If any image failed to file out, or the document
//      couldn't be parsed at all, the desired set is short through no fault of
//      the photos it is missing — so the whole prune is skipped for that save
//      rather than deleting files a working document still references. This is
//      the rule that keeps a throttled upload from costing a photo: a failed
//      write used to leave its path out of the desired set, and prune then
//      deleted the perfectly good file already sitting at that path.
//
// The load and prune sweeps are also *bounded* (see `cloudRetry.ts`): a few
// files are in flight at a time rather than the whole gallery at once. Firing
// several hundred content-API requests in one tick is what provoked the
// throttling and the browser-level connection failures in the first place.
//
// Encrypted documents skip this layer entirely (they keep photos inside the
// AES-GCM envelope rather than leak plaintext image files onto the drive), so
// the wrapper is composed only for the plaintext cloud path in `useSyncEngine`.
//
// ## Tiering (the `tiered` option)
//
// Filing one image per file is right for a *local folder* — a browsable tree is
// that backend's whole point, and a directory on your own disk has no rate
// limit. It is wrong for a cloud drive, where reading ~840 files on open is
// what provokes the throttling in the first place. So a cloud backend passes
// `tiered`, which splits what this module reads into two tiers:
//
//   - **Render tier** — every crop, downscaled to a 288 px tile and batched
//     into a few ZIP packs (`atlas.ts`, `atlasStore.ts`). Read on open, in a
//     handful of requests, and hung on `photoTile`. It is derived and
//     disposable, so it is never written back over an archival file and never
//     enters the synced document.
//   - **Archival tier** — the files this module has always written, unchanged.
//     The crop is now only read when the atlas didn't cover it, and the kept
//     original is not read on open at all: `photoSource.ts` fetches one when a
//     lightbox or the cropper actually asks.
//
// Everything the archival tier does — the safety rules above, the deterministic
// names, the reconcile, the prune — is untouched by this. The atlas is purely
// additive: if every pack failed to read, the tiered path would simply fall
// back to reading crops the way it always did.

import {
  bytesToDataUrl,
  dataUrlToBytes,
} from "@niclaslindstedt/oss-framework/files";
import {
  type DropboxAuth,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

import { isAtlasPath, type AtlasInput } from "./atlas.ts";
import { applyTiles, createAtlas } from "./atlasStore.ts";
import { MEDIA_CONCURRENCY, mapLimit } from "./cloudRetry.ts";
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
 *  `photos/<name>-<tag>-<number>.jpg`. */
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
  photoTile?: string | null;
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

/** One externalisable image on a gallery photo: the data-URI field to file out,
 *  the deterministic path builder (keyed on the photo's 1-based gallery
 *  position), and the doc field the path maps to. */
type Slot = {
  data: "photo" | "photoSource";
  path: "photoPath" | "photoSourcePath";
  pathFor: (c: PhotoContact, index: number) => string;
};

const SLOTS: Slot[] = [
  {
    data: "photo",
    path: "photoPath",
    pathFor: (c, index) => photoPathFor(c, index),
  },
  {
    data: "photoSource",
    path: "photoSourcePath",
    pathFor: (c, index) => photoSourcePathFor(c, index),
  },
];

/** Whether a *stored* document references any photo file under an outdated
 *  path — one filed by an older build's `<contactId>-<photoId>` scheme, or one
 *  whose contact was since renamed (so the name slug no longer matches). Run on
 *  load, a true result is the "re-file these into the current
 *  `<tag>-<index>` layout" signal the sweep keys off: the next save writes each
 *  photo to its current path and prunes the stale file. A fully up-to-date copy
 *  reads false. */
function needsRefile(doc: PhotoDoc): boolean {
  const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
  if (!contacts) return false;
  return contacts.some((c) => {
    const photos = c.photos ?? [];
    return photos.some((entry, i) => {
      const index = i + 1;
      return (
        (entry.photoPath != null &&
          entry.photoPath !== photoPathFor(c, index)) ||
        (entry.photoSourcePath != null &&
          entry.photoSourcePath !== photoSourcePathFor(c, index))
      );
    });
  });
}

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
  options: { tiered?: boolean } = {},
): StorageAdapter {
  // Paths this session has already written, keyed to the source fingerprint, so
  // a re-crop (same original) or a debounced re-save doesn't re-upload.
  const written = new Map<string, string>();
  // The render tier, on the backends that want it (see the module note). Held
  // across the adapter's life so a save reuses the pack indexes the load read.
  const tiered = options.tiered === true;
  const atlas = tiered ? createAtlas(photos) : null;

  // Save side: write each contact's images to their files and strip them from
  // the outgoing JSON. Returns the stripped text, the set of paths the document
  // still wants, and whether that set is a *complete* account of the document —
  // only a complete one may drive the post-commit prune (see rule 3 above).
  async function externalise(text: string): Promise<{
    text: string;
    desired: Set<string>;
    complete: boolean;
    atlas: AtlasInput;
  }> {
    const desired = new Set<string>();
    // Collected in this same walk rather than by re-parsing the document, which
    // for a book full of inline photos is megabytes of work.
    const atlasInput: AtlasInput = { entries: [], inline: [] };
    let doc: PhotoDoc;
    try {
      doc = JSON.parse(text) as PhotoDoc;
    } catch {
      // Nothing was understood, so nothing may be judged an orphan.
      return { text, desired, complete: false, atlas: atlasInput };
    }
    const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
    if (!contacts) return { text, desired, complete: false, atlas: atlasInput };
    let complete = true;

    for (const c of contacts) {
      const gallery = c.photos ?? [];
      for (let i = 0; i < gallery.length; i += 1) {
        const entry = gallery[i]!;
        const index = i + 1;
        // Note the entry before the slots below strip its bytes: every entry
        // keeps its pack alive, and one holding a crop can have a tile baked.
        atlasInput.entries.push({ contactId: c.id, entryId: entry.id });
        if (entry.photo) {
          atlasInput.inline.push({
            contactId: c.id,
            entryId: entry.id,
            dataUrl: entry.photo,
          });
        }
        for (const slot of SLOTS) {
          const inline = entry[slot.data];
          if (inline) {
            const path = slot.pathFor(c, index);
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
              // The path is still *wanted* — a copy may already be filed there
              // from an earlier save — so claim it and stand the prune down, or
              // a throttled upload would delete the photo it failed to replace.
              desired.add(path);
              complete = false;
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
    return { text: JSON.stringify(doc), desired, complete, atlas: atlasInput };
  }

  // Remove photo files no surviving contact references. Best-effort and only
  // after the document save commits — and only when `externalise` returned a
  // complete account of the document, since a short desired set would make
  // perfectly good files look like orphans (see rule 3 in the module note).
  async function prune(desired: Set<string>, complete: boolean): Promise<void> {
    if (!complete) {
      log.warn(
        "skipping the orphan prune — some photos could not be filed out, " +
          "so a file this save didn't account for is not an orphan",
      );
      return;
    }
    let existing: string[];
    try {
      existing = await photos.list();
    } catch (err) {
      log.warn(`could not list photos to prune (${errMsg(err)})`);
      return;
    }
    // Atlas packs are the render tier's business, not the archival tier's — no
    // contact ever "wants" one by path, so they would look like orphans to
    // every save. `atlasStore.ts` owns their lifecycle.
    const orphans = existing.filter((p) => !isAtlasPath(p) && !desired.has(p));
    if (orphans.length === 0) return;
    log.info(`pruning ${orphans.length} orphaned photo file(s)`);
    await mapLimit(orphans, MEDIA_CONCURRENCY, (p) =>
      photos
        .remove(p)
        .then(() => {
          written.delete(p);
        })
        .catch((err: unknown) => {
          log.warn(`could not remove ${p} (${errMsg(err)})`);
        }),
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

    const unreferenced = existing.filter(
      (p) => !isAtlasPath(p) && !referenced.has(p),
    );
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
      let entry: PhotoEntry | undefined;
      if (parsed.photoId != null) {
        // Legacy `<contactId>-<photoId>` file: re-attach to the entry with that
        // id, minting one if the document lost the entry itself (a photo a user
        // hand-dropped into the drive under the old naming).
        entry = gallery.find((p) => p.id === parsed.photoId);
        if (!entry) {
          entry = { id: parsed.photoId };
          gallery.push(entry);
        }
      } else if (parsed.index != null) {
        // Current `<tag>-<index>` file: the index is the entry's 1-based gallery
        // position. Re-attach to that entry; a file that names a position the
        // gallery doesn't have is left unattached rather than guessed at.
        entry = gallery[parsed.index - 1];
      }
      if (!entry) {
        unmatched.push(path);
        continue;
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

  // Load side: fetch each filed image back onto its contact, a few at a time.
  // A read that fails leaves the entry's path in place and its bytes absent —
  // the loaded copy is then *incomplete*, which the caller must know about
  // before it adopts the copy over a working document that still holds those
  // bytes (see the `missing` count in `load`).
  async function rehydrate(
    text: string,
  ): Promise<{ text: string; missing: number; atlasGap: boolean }> {
    let doc: PhotoDoc;
    try {
      doc = JSON.parse(text) as PhotoDoc;
    } catch {
      return { text, missing: 0, atlasGap: false };
    }
    const contacts = Array.isArray(doc.contacts) ? doc.contacts : null;
    if (!contacts) return { text, missing: 0, atlasGap: false };

    // The render tier first: one listing plus a handful of pack downloads gives
    // every contact a face. Anything it covers needs no archival read at all,
    // which is where the request saving comes from.
    let applied = 0;
    if (atlas) applied = applyTiles(doc, await atlas.read());

    // Flatten to one job per filed image so the whole load — not each contact —
    // is what gets rate-limited.
    const jobs: { entry: PhotoEntry; slot: Slot; path: string }[] = [];
    for (const c of contacts) {
      for (const entry of c.photos ?? []) {
        for (const slot of SLOTS) {
          // On a tiered backend the kept original is never read on open — it is
          // fetched on demand when a lightbox or the cropper asks for it (see
          // `photoSource.ts`), which is most of the cold-start traffic gone.
          if (tiered && slot.data === "photoSource") continue;
          // A crop the atlas already covered needs no archival read either.
          if (slot.data === "photo" && entry.photoTile) continue;
          const path = entry[slot.path];
          if (path && !entry[slot.data]) jobs.push({ entry, slot, path });
        }
      }
    }
    if (jobs.length === 0) {
      return {
        text: applied > 0 ? JSON.stringify(doc) : text,
        missing: 0,
        atlasGap: atlasGap(contacts),
      };
    }

    let changed = applied > 0;
    let missing = 0;
    await mapLimit(jobs, MEDIA_CONCURRENCY, async ({ entry, slot, path }) => {
      try {
        const bytes = await photos.read(path);
        if (bytes) {
          const url = bytesToDataUrl("image/jpeg", bytes);
          entry[slot.data] = url;
          written.set(path, fingerprint(url));
          changed = true;
        } else {
          // The file is genuinely gone from the backend — not a read failure,
          // so it doesn't hold the copy back; the reference is simply stale.
          log.warn(`no file at ${path} — the reference is stale`);
        }
      } catch (err) {
        missing += 1;
        log.warn(`could not read ${path} (${errMsg(err)})`);
      }
    });
    if (missing > 0) {
      log.warn(
        `${missing} of ${jobs.length} photo file(s) could not be read — ` +
          "the loaded copy is incomplete",
      );
    }
    return {
      text: changed ? JSON.stringify(doc) : text,
      missing,
      atlasGap: atlasGap(contacts),
    };
  }

  /** Whether the render tier is missing a tile for a photo this copy is now
   *  holding the crop of — the "the atlas hasn't caught up with this book yet"
   *  signal.
   *
   *  Tiles are only ever *written* on save, so without this a device that
   *  adopted a cloud copy and never edited it would never build the atlas, and
   *  every future open would keep paying for the archival reads. Asking for one
   *  sweep converges it: the save files the tiles, and the next open reads them
   *  instead. Untiered backends never report a gap. */
  function atlasGap(contacts: PhotoContact[]): boolean {
    if (!tiered) return false;
    return contacts.some((c) =>
      (c.photos ?? []).some((entry) => entry.photo && !entry.photoTile),
    );
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
      // A copy that still points at outdated file paths (an older build's naming,
      // or a since-renamed contact) needs re-filing into the current layout — the
      // sweep's save rewrites each photo to its current path and prunes the old.
      let stale = false;
      try {
        stale = needsRefile(JSON.parse(text) as PhotoDoc);
      } catch {
        stale = false;
      }
      const hydrated = await rehydrate(text);
      // The same one-time sweep also builds the render tier for a book that
      // predates it (see `atlasGap`) — tiles are only ever written on save, so
      // without a nudge a copy nobody edits would never get an atlas.
      if (
        onPhotosNeedResave &&
        (inline || changed || stale || hydrated.atlasGap)
      ) {
        onPhotosNeedResave();
      }
      return { ...snap, text: hydrated.text };
    },
    async save(text, baseRevision) {
      const {
        text: stripped,
        desired,
        complete,
        atlas: atlasInput,
      } = await externalise(text);
      const snap = await inner.save(stripped, baseRevision);
      await prune(desired, complete);
      // The render tier last, and best-effort: the archival files are already
      // committed, so a pack that won't build or won't upload costs a few
      // contacts a lazy fetch on the next device and nothing more.
      if (atlas) await atlas.sync(atlasInput);
      return snap;
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
