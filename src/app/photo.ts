// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Contact-photo intake and the Facebook-style circle crop. A picked image is
// downscaled to a compact *source* JPEG (`resizeToSource`); the cropper frames
// it inside the circle with zoom/pan and bakes the visible region to a square
// *display* JPEG (`bakeCircleCrop`). The display JPEG is what the avatar and
// the vCard export read; the source is kept so the crop can be re-adjusted, and
// on a cloud backend both are externalised to real binary JPEG files at
// deterministic paths (`photoPathFor` / `photoSourcePathFor`) — the framework's
// `dataUrl`⇄`bytes` codec (its `files` module) is what the externaliser decodes
// across so what lands on the drive is image bytes, not base64 text (see
// `photoStore.ts`).
//
// The transform math is resolution-independent (see `PhotoTransform`): the same
// framing renders in the cropper's viewport and bakes at the output size from
// one set of numbers, so re-adjusting always lands where the user left it.

import { exportFileStem } from "./export.ts";
import type { Contact, PhotoTransform } from "./types.ts";

/** Longest edge of the kept source original, in px. Big enough to re-crop
 *  crisply, small enough to keep the document / uploaded file light. */
const SOURCE_MAX_EDGE = 1024;
/** Side of the baked square display crop, in px. */
const DISPLAY_SIZE = 512;
const JPEG_QUALITY = 0.85;

/** The neutral framing a freshly-picked image opens at: cover-fit, centred. */
export const DEFAULT_TRANSFORM: PhotoTransform = { scale: 1, x: 0, y: 0 };

// --- intake ------------------------------------------------------------------

/** Read a picked image file and downscale it (longest edge ≤ `SOURCE_MAX_EDGE`)
 *  to a compact JPEG data URI — the source the cropper frames. */
export async function fileToPhotoSource(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(
      1,
      SOURCE_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- geometry ----------------------------------------------------------------

/** Where the source image sits inside a square crop viewport of side `size`,
 *  for a given framing. Shared by the cropper (viewport px) and the bake
 *  (output px): pass the size, get the draw rectangle. The cover-fit baseline
 *  guarantees the image always covers the square at `scale` ≥ 1. */
export function drawRect(
  naturalW: number,
  naturalH: number,
  size: number,
  transform: PhotoTransform,
): { x: number; y: number; w: number; h: number } {
  const cover = Math.max(size / naturalW, size / naturalH);
  const s = cover * Math.max(transform.scale, 1);
  const w = naturalW * s;
  const h = naturalH * s;
  return {
    x: (size - w) / 2 + transform.x * size,
    y: (size - h) / 2 + transform.y * size,
    w,
    h,
  };
}

/** Clamp a framing so the image still fully covers the circle — the pan can't
 *  drag an edge past the viewport centre. Keeps the cropper honest. */
export function clampTransform(
  naturalW: number,
  naturalH: number,
  transform: PhotoTransform,
): PhotoTransform {
  const scale = Math.max(1, transform.scale);
  const cover = Math.max(1 / naturalW, 1 / naturalH); // size factored out (=1)
  const w = naturalW * cover * scale;
  const h = naturalH * cover * scale;
  const maxX = Math.max(0, (w - 1) / 2);
  const maxY = Math.max(0, (h - 1) / 2);
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, transform.x)),
    y: Math.min(maxY, Math.max(-maxY, transform.y)),
  };
}

// --- bake --------------------------------------------------------------------

/** Render the framed circle region of a source image to a square display JPEG
 *  — the `photo` the avatar and export use. The square is rounded by CSS at
 *  display time, so nothing is lost by baking a square rather than a disc. */
export async function bakeCircleCrop(
  source: string,
  transform: PhotoTransform,
  size: number = DISPLAY_SIZE,
): Promise<string> {
  const img = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  const r = drawRect(img.naturalWidth, img.naturalHeight, size, transform);
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

// --- deterministic file path -------------------------------------------------

/** A contact reference the deterministic photo paths are built from. */
type PhotoNamed = {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
};

/** The file path a gallery photo's *display* crop is externalised to on a cloud
 *  backend: `photos/<name-slug>-<contactId>-<photoId>.jpg`. Built from the
 *  display name (reusing the export filename slug), the stable contact id, and
 *  the photo's own id, so it is deterministic, unique across name collisions and
 *  across the several photos one card can carry, and — as a real binary JPEG —
 *  easy to preview in the drive. */
export function photoPathFor(contact: PhotoNamed, photoId: string): string {
  return `photos/${photoStem(contact)}-${photoId}.jpg`;
}

/** The file path a gallery photo's larger *source* original is externalised to:
 *  `photos/<name-slug>-<contactId>-<photoId>-source.jpg`. Sits beside the
 *  display crop so a fresh device can re-open the cropper on the original. */
export function photoSourcePathFor(
  contact: PhotoNamed,
  photoId: string,
): string {
  return `photos/${photoStem(contact)}-${photoId}-source.jpg`;
}

function photoStem(contact: PhotoNamed): string {
  const stem = exportFileStem({
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    company: contact.company,
  } as Contact);
  return `${stem}-${contact.id}`;
}

/** What a filed photo path names: the contact it belongs to, the photo's own
 *  id, and whether it is the larger source original rather than the display
 *  crop. */
export type ParsedPhotoPath = {
  contactId: string;
  photoId: string;
  source: boolean;
};

/** Parse a filed photo path back to the contact + photo it belongs to — the
 *  inverse of {@link photoPathFor} / {@link photoSourcePathFor}, and the key to
 *  re-indexing "lost" photo files (see `photoStore.ts`).
 *
 *  The filename is `photos/<name-slug>-<contactId>-<photoId>[-source].jpg`. The
 *  leading `<name-slug>` is cosmetic — a human-readable label that can itself
 *  contain hyphens — so rather than guess where it ends, the parse anchors on a
 *  *known* contact id: the one segment that must line up with a real card. That
 *  makes it robust to a slug that no longer matches a renamed contact, and means
 *  a photo a user hand-drops into the drive is picked up as long as its name
 *  carries the right `-<contactId>-` and a non-empty photo id after it — the
 *  slug in front can be anything readable. Returns null when the path names no
 *  known contact. */
export function parsePhotoPath(
  path: string,
  contactIds: Iterable<string>,
): ParsedPhotoPath | null {
  const match = /^photos\/(.+?)(-source)?\.jpg$/i.exec(path);
  if (!match) return null;
  const stem = match[1]!;
  const source = match[2] != null;
  for (const contactId of contactIds) {
    const marker = `-${contactId}-`;
    const at = stem.indexOf(marker);
    if (at === -1) continue;
    const photoId = stem.slice(at + marker.length);
    if (photoId.length === 0) continue;
    return { contactId, photoId, source };
  }
  return null;
}

// --- shared ------------------------------------------------------------------

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not read the image"));
    img.src = url;
  });
}
