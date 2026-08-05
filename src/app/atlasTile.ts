// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Baking one atlas tile: the browser-only half of `atlas.ts`.
//
// A tile is the contact's display crop re-encoded down to `TILE_PX` — the
// largest an avatar is ever drawn (96 CSS px at a 3× device pixel ratio). The
// stored crop is 512 square, so this is roughly a 5× reduction in pixels and a
// far bigger one in bytes, which is the whole reason the render tier is cheap
// enough to fetch on every open.
//
// It is deliberately a *lossy* step. The tile is a derived render cache whose
// full-resolution original is safe in the archival tier (`photoStore.ts`), so a
// second JPEG generation costs nothing that matters. A crop that is already at
// or under the tile size is passed through untouched rather than re-encoded, so
// small photos never lose a generation for nothing.
//
// Everything here needs a `document` and a canvas, so outside a browser (tests,
// SSR) every entry point resolves to null and the caller simply files no tile —
// the atlas is optional by construction.

import { dataUrlToBytes } from "@niclaslindstedt/oss-framework/files";

import { TILE_PX, TILE_QUALITY } from "./atlas.ts";

/** Bake one crop down to a tile, or null where no canvas is available or the
 *  image can't be decoded. Never throws: a tile that can't be baked is a tile
 *  the atlas simply doesn't carry, and the reader falls back to the archival
 *  file. */
export async function bakeTile(dataUrl: string): Promise<Uint8Array | null> {
  if (typeof document === "undefined") return null;
  try {
    const image = await decode(dataUrl);
    const side = Math.max(image.width, image.height);
    if (side === 0) return null;
    // Already small enough — keep the original bytes rather than spending a
    // JPEG generation to make an identically-sized copy.
    if (side <= TILE_PX) return dataUrlToBytes(dataUrl)?.bytes ?? null;

    const scale = TILE_PX / side;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await encode(canvas);
  } catch {
    return null;
  }
}

/** Decode a data URL to something drawable. */
function decode(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("could not decode the crop"));
    image.src = dataUrl;
  });
}

/** Encode a canvas to JPEG bytes, preferring `toBlob` (which keeps the encode
 *  off the main thread where the browser can manage it) and falling back to
 *  `toDataURL` for engines that don't hand back a blob. */
async function encode(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/jpeg", TILE_QUALITY);
    } catch {
      resolve(null);
    }
  });
  if (blob) return new Uint8Array(await blob.arrayBuffer());
  const url = canvas.toDataURL("image/jpeg", TILE_QUALITY);
  return dataUrlToBytes(url)?.bytes ?? null;
}
