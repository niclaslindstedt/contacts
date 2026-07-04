// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The contact photo gallery — one small module that owns the "which photo is
// the face, and how the set changes" rules so nothing else has to reach into
// the `photos` array directly.
//
// A card carries a `photos` list (see `ContactPhoto`) and an `activePhotoId`
// pointer at the one currently shown. The pointer is *soft*: when it's absent —
// or points at an entry that was removed — the first photo stands in, so a card
// migrated or imported with a single photo needs no explicit selection, and
// removing the active photo never leaves the avatar pointing at nothing.
//
// The mutators are pure: each takes a contact and returns the `Partial<Contact>`
// patch to feed `updateContact`, so a swap / add / remove is one undoable store
// step. New photo ids are minted by the caller (the UI, via `freshId`) and
// passed in, keeping this module free of any id source and node-testable.

import type { Contact, ContactPhoto } from "./types.ts";

/** A contact viewed only through its gallery — all these helpers need. */
type WithPhotos = Pick<Contact, "photos" | "activePhotoId">;

/** The gallery as a plain array (never undefined), in stored order. */
export function photoList(c: WithPhotos): ContactPhoto[] {
  return c.photos ?? [];
}

/** How many photos the card holds. */
export function photoCount(c: WithPhotos): number {
  return photoList(c).length;
}

/** Whether the card has any photo at all (drives the avatar's image vs. glyph
 *  choice and the "has a picture" checks). */
export function hasPhoto(c: WithPhotos): boolean {
  return activePhoto(c) !== undefined;
}

/** The currently-shown photo: the one `activePhotoId` names, or — when that's
 *  absent or stale — the first in the list, or undefined for an empty gallery.
 *  Every read of "the contact's photo" goes through here. */
export function activePhoto(c: WithPhotos): ContactPhoto | undefined {
  const photos = photoList(c);
  if (photos.length === 0) return undefined;
  const byId = c.activePhotoId
    ? photos.find((p) => p.id === c.activePhotoId)
    : undefined;
  return byId ?? photos[0];
}

/** The active photo's index in the gallery (0 for an empty or unselected
 *  gallery) — the start position a swipeable viewer opens at. */
export function activePhotoIndex(c: WithPhotos): number {
  const active = activePhoto(c);
  if (!active) return 0;
  return Math.max(
    0,
    photoList(c).findIndex((p) => p.id === active.id),
  );
}

/** Append a photo and make it the face — the upload / drop outcome. The freshly
 *  added picture becomes active so the card immediately shows what was just
 *  added. */
export function withPhotoAdded(
  c: WithPhotos,
  photo: ContactPhoto,
): Partial<Contact> {
  return { photos: [...photoList(c), photo], activePhotoId: photo.id };
}

/** Drop a photo from the gallery. If it was the active one, the pointer falls
 *  to a neighbour (the previous entry, else the new first) so the avatar never
 *  ends up on a gone photo; emptying the gallery clears the pointer. */
export function withPhotoRemoved(
  c: WithPhotos,
  photoId: string,
): Partial<Contact> {
  const photos = photoList(c);
  const idx = photos.findIndex((p) => p.id === photoId);
  if (idx === -1) return { photos, activePhotoId: c.activePhotoId };
  const next = photos.filter((p) => p.id !== photoId);
  const wasActive = activePhoto(c)?.id === photoId;
  if (!wasActive) return { photos: next, activePhotoId: c.activePhotoId };
  const neighbour = next[idx - 1] ?? next[0];
  return { photos: next, activePhotoId: neighbour?.id ?? null };
}

/** Make an existing gallery entry the face — the outcome of tapping a
 *  thumbnail. A no-op patch (unchanged pointer) when the id isn't in the
 *  gallery. */
export function withActivePhoto(
  c: WithPhotos,
  photoId: string,
): Partial<Contact> {
  const exists = photoList(c).some((p) => p.id === photoId);
  return { activePhotoId: exists ? photoId : c.activePhotoId };
}

/** Replace one entry's image fields in place — the re-adjust (re-crop) outcome,
 *  which keeps the entry's id and position so the selection and gallery order
 *  are untouched. */
export function withPhotoAdjusted(
  c: WithPhotos,
  photoId: string,
  patch: Partial<Omit<ContactPhoto, "id">>,
): Partial<Contact> {
  return {
    photos: photoList(c).map((p) =>
      p.id === photoId ? { ...p, ...patch } : p,
    ),
  };
}
