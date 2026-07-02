// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Contact-photo intake: read a user-picked image file, downscale it to a
// square thumbnail on a canvas, and hand back a compact JPEG data URI. The
// data URI is what the document stores (it travels with JSON exports and
// embeds into vCards), so keeping it small keeps the whole document small.

const PHOTO_SIZE = 256;
const JPEG_QUALITY = 0.85;

export async function fileToPhotoDataUri(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not read the image"));
    img.src = url;
  });
}
