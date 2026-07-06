// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Restoring a contact's inline media after the local working copy has had to
// shed it. The always-present localStorage working copy keeps each photo and
// attachment inline as a data URI so the app renders offline; but that copy is
// bounded by the browser's storage quota, and when the document won't fit,
// `localDocBackend.save` falls back to `stripInlineMedia` — it keeps every
// contact and every media *entry* (and its cloud path) but drops the heavy
// image / file *bytes*. So after a cold restart the working copy can hold a
// photo entry with a `photoPath` but no `photo`, and the avatar falls back to
// the glyph — the "my photos disconnected on restart" symptom.
//
// On a connected file backend those bytes are safe: the externaliser filed them
// out to real JPEG / binary files and the backend copy re-hydrates them on load
// (see `photoStore.ts` / `attachmentStore.ts`). This module is the small,
// pure merge that carries them the last step home — from that freshly-loaded
// backend copy back onto the working document — so the sync engine can do it on
// every open rather than only when the user hits the developer "Reindex" button.
//
// The merge is strictly *additive*: it fills only a field the working copy is
// missing, and only on an entry the working copy still has. It never overwrites
// a byte the working copy already holds, and never resurrects an entry the
// backend has but the working copy doesn't — so a photo added or re-cropped
// locally (and not yet synced), or one deleted locally, is left exactly as the
// working copy has it.

import type { AppData, Attachment, ContactPhoto } from "./types.ts";

/** Fill a working-copy photo's missing image bytes / cloud paths from the
 *  backend copy's matching entry, returning the same object when nothing was
 *  missing so the caller can detect a no-op. */
function fillPhoto(local: ContactPhoto, remote: ContactPhoto): ContactPhoto {
  const patch: Partial<ContactPhoto> = {};
  if (!local.photo && remote.photo) patch.photo = remote.photo;
  if (!local.photoSource && remote.photoSource) {
    patch.photoSource = remote.photoSource;
  }
  if (!local.photoPath && remote.photoPath) patch.photoPath = remote.photoPath;
  if (!local.photoSourcePath && remote.photoSourcePath) {
    patch.photoSourcePath = remote.photoSourcePath;
  }
  return Object.keys(patch).length > 0 ? { ...local, ...patch } : local;
}

/** The attachment counterpart of {@link fillPhoto}: fill missing file bytes /
 *  cloud path from the backend copy's matching attachment. */
function fillAttachment(local: Attachment, remote: Attachment): Attachment {
  const patch: Partial<Attachment> = {};
  if (!local.data && remote.data) patch.data = remote.data;
  if (!local.dataPath && remote.dataPath) patch.dataPath = remote.dataPath;
  return Object.keys(patch).length > 0 ? { ...local, ...patch } : local;
}

/** Merge inline media (photo / attachment bytes and their cloud paths) from a
 *  freshly-loaded backend copy `remote` into the working document `current`,
 *  filling only the fields the working copy is missing (see the module note for
 *  the additive contract). Returns a new document when anything was filled in,
 *  or `null` when the working copy already holds every byte — so the caller can
 *  skip a needless state update. Matches contacts and their media entries by
 *  id, so a renamed contact (whose cloud file paths change) still re-hydrates. */
export function mergeInlineMedia(
  current: AppData,
  remote: AppData,
): AppData | null {
  const remoteById = new Map(remote.contacts.map((c) => [c.id, c] as const));
  let changed = false;

  const contacts = current.contacts.map((c) => {
    const r = remoteById.get(c.id);
    if (!r) return c;
    let next = c;

    if (c.photos && c.photos.length > 0) {
      const remotePhotos = new Map(
        (r.photos ?? []).map((p) => [p.id, p] as const),
      );
      let photosChanged = false;
      const photos = c.photos.map((p) => {
        const rp = remotePhotos.get(p.id);
        if (!rp) return p;
        const merged = fillPhoto(p, rp);
        if (merged !== p) photosChanged = true;
        return merged;
      });
      if (photosChanged) {
        next = { ...next, photos };
        changed = true;
      }
    }

    if (c.attachments && c.attachments.length > 0) {
      const remoteAttachments = new Map(
        (r.attachments ?? []).map((a) => [a.id, a] as const),
      );
      let attachmentsChanged = false;
      const attachments = c.attachments.map((a) => {
        const ra = remoteAttachments.get(a.id);
        if (!ra) return a;
        const merged = fillAttachment(a, ra);
        if (merged !== a) attachmentsChanged = true;
        return merged;
      });
      if (attachmentsChanged) {
        next = { ...next, attachments };
        changed = true;
      }
    }

    return next;
  });

  return changed ? { ...current, contacts } : null;
}
