// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Contact-photo intake and the Facebook-style circle crop. A picked image is
// downscaled to a compact *source* JPEG (`resizeToSource`); the cropper frames
// it inside the circle with zoom/pan and bakes the visible region to a square
// *display* JPEG (`bakeCircleCrop`). The display JPEG is what the avatar and
// the vCard export read; the source is kept so the crop can be re-adjusted, and
// on a cloud backend both are externalised to real binary JPEG files at
// deterministic paths (`photoPathFor` / `photoSourcePathFor`) — the
// `dataUrl`⇄`bytes` seam below is what the externaliser decodes across so what
// lands on the drive is image bytes, not base64 text (see `photoStore.ts`).
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

/** The file path a contact's *display* crop is externalised to on a cloud
 *  backend: `photos/<name-slug>-<id>.jpg`. Built from the display name (reusing
 *  the export filename slug) and the stable id, so it is deterministic, unique
 *  across name collisions, and — as a real binary JPEG — easy to preview in the
 *  drive. */
export function photoPathFor(contact: PhotoNamed): string {
  return `photos/${photoStem(contact)}.jpg`;
}

/** The file path a contact's larger *source* original is externalised to:
 *  `photos/<name-slug>-<id>-source.jpg`. Sits beside the display crop so a
 *  fresh device can re-open the cropper on the original. */
export function photoSourcePathFor(contact: PhotoNamed): string {
  return `photos/${photoStem(contact)}-source.jpg`;
}

function photoStem(contact: PhotoNamed): string {
  const stem = exportFileStem({
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    company: contact.company,
  } as Contact);
  return `${stem}-${contact.id}`;
}

// --- data URL ⇄ bytes (the externalisation seam) -----------------------------

/** Parsed pieces of a base64 `data:` URL. */
export type DataUrlBytes = { mime: string; bytes: Uint8Array };

/** Decode a base64 `data:` URL into its MIME type and bytes, or null when the
 *  string isn't a base64 data URL. */
export function dataUrlToBytes(
  dataUrl: string | null | undefined,
): DataUrlBytes | null {
  if (!dataUrl) return null;
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match || !match[2]) return null;
  const mime = match[1] || "application/octet-stream";
  try {
    const binary = atob(match[3]!);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { mime, bytes };
  } catch {
    return null;
  }
}

/** Encode bytes + MIME type into a base64 `data:` URL. Chunked so a large
 *  image doesn't blow the argument limit of `String.fromCharCode(...spread)`. */
export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
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
