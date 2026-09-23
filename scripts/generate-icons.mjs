#!/usr/bin/env node
// Generate the PWA install icons and the social-preview image from the same
// geometry as public/icons/icon.svg — a stylized person drawn as an outline (a
// head ring over rounded shoulders), stroked in a green gradient on the app's
// dark surface, in the single-glyph style shared with the sibling notes and
// checklist apps. Pure Node (zlib + a minimal PNG encoder), so the pipeline
// needs no native image dependencies. Rerun with `npm run icons` / `make icons`
// after changing the mark.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
mkdirSync(iconsDir, { recursive: true });

// The app look's surface (see src/app/look.ts) and the mark's green gradient —
// the family hue the sibling notes and checklist apps wear. Kept in lockstep
// with the <linearGradient> stops in public/icons/icon.svg.
const BG = [11, 13, 16]; // #0b0d10
const GRAD_TOP = [110, 231, 183]; // #6ee7b7
const GRAD_BOT = [52, 211, 153]; // #34d399

// --- minimal PNG encoder ----------------------------------------------------

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Pack already-encoded PNG blobs into a single ICONDIR (a .ico file). PNG-
// compressed entries are honoured by every current browser and by Windows
// since Vista, so one .ico carrying 16/32/48 px PNGs is the whole legacy-
// favicon story — the raster fallback for tabs that don't render the SVG mark.
function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // resource type: icon
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = header.length + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const e = dir.subarray(i * 16);
    e[0] = size >= 256 ? 0 : size; // width  (0 encodes 256)
    e[1] = size >= 256 ? 0 : size; // height (0 encodes 256)
    e[2] = 0; // palette size (0 for a true-colour PNG entry)
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8); // bytes in this entry
    e.writeUInt32LE(offset, 12); // byte offset from the file start
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

// The other .ico, and it exists because a resource compiler is not a browser.
//
// `encodeIco` above packs PNG-compressed entries, which every current browser
// and Windows itself read happily. The Windows RESOURCE COMPILER does not:
// `tauri-build` embeds `icons/icon.ico` into the executable through `llvm-rc`
// (or `rc.exe`), and those parse the classic DIB entry rather than a PNG one —
// so the desktop shell's icon is packed the old way instead.
//
// A DIB entry is a `BITMAPINFOHEADER` whose height is DOUBLED, because the
// format still describes two stacked bitmaps: the bottom-up BGRA colour one,
// and a 1-bit AND mask. The mask is all zeroes (every pixel opaque as far as
// it is concerned) and the alpha channel does the real work, which is what
// every 32-bit icon since Windows XP does. Its rows are still padded to four
// bytes, and a parser that reads the header will read them.
function dibEntry(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight — colour + mask
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    // Bottom-up: the last row of the image is the first row of the DIB.
    const from = (size - 1 - y) * size * 4;
    for (let x = 0; x < size; x++) {
      const at = from + x * 4;
      const to = (y * size + x) * 4;
      pixels[to] = rgba[at + 2]; // B
      pixels[to + 1] = rgba[at + 1]; // G
      pixels[to + 2] = rgba[at]; // R
      pixels[to + 3] = rgba[at + 3]; // A
    }
  }

  const maskStride = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, pixels, Buffer.alloc(maskStride * size)]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- the mark ----------------------------------------------------------------

// The mark's geometry, written in the SVG's own 64-unit coordinates and mapped
// into unit space, so the numbers below read straight off public/icons/icon.svg
// — change one and change the other. `u` is that mapping.
const u = (v) => v / 64;

// Stroke weight (SVG stroke-width="6"); the outline is every point within half
// of it of the mark's centre lines.
const HALF_STROKE = u(3);

// The head ring: SVG <circle cx="32" cy="21.5" r="8.5">.
const HEAD = { x: u(32), y: u(21.5), r: u(8.5) };

// The shoulders, "M16 51 V48 a8 8 0 0 1 8 -8 H40 a8 8 0 0 1 8 8 V51", split
// into the pieces a distance function can handle: three straight runs and the
// two quarter-circle corners that join them. Round caps and joins come for
// free — a distance-to-segment already rounds off at the ends.
const CORNER_R = u(8);
const SEGMENTS = [
  [u(16), u(51), u(16), u(48)], // left side, below the corner
  [u(24), u(40), u(40), u(40)], // the flat shoulder top
  [u(48), u(48), u(48), u(51)], // right side, below the corner
];
// Each corner is the quarter of a circle lying in the (sx, sy) direction from
// its centre: the top-left corner is the up-and-left quarter, and so on.
const CORNERS = [
  { x: u(24), y: u(48), sx: -1, sy: -1 },
  { x: u(40), y: u(48), sx: 1, sy: -1 },
];

// The gradient runs top-to-bottom over the mark's outer extent — the top of the
// head ring to the bottom of the shoulders' round caps — matching the
// userSpaceOnUse y1=10 / y2=54 span in the SVG.
const GRAD_Y0 = HEAD.y - HEAD.r - HALF_STROKE;
const GRAD_Y1 = u(51) + HALF_STROKE;

// The mark's ink at unit-space height `y`, interpolated along the gradient.
function markInk(y) {
  const t = Math.max(0, Math.min(1, (y - GRAD_Y0) / (GRAD_Y1 - GRAD_Y0)));
  return [
    GRAD_TOP[0] + (GRAD_BOT[0] - GRAD_TOP[0]) * t,
    GRAD_TOP[1] + (GRAD_BOT[1] - GRAD_TOP[1]) * t,
    GRAD_TOP[2] + (GRAD_BOT[2] - GRAD_TOP[2]) * t,
  ];
}

// Distance from (px, py) to the line segment a→b.
function distSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = Math.max(
    0,
    Math.min(1, len2 === 0 ? 0 : ((px - ax) * vx + (py - ay) * vy) / len2),
  );
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}

// Distance from (px, py) to a quarter circle of radius `r` around `c`, spanning
// the quadrant `c` points at. Inside that quadrant the nearest point is on the
// arc itself; outside it, it is whichever of the arc's two ends is closer.
function distCorner(px, py, c, r) {
  const dx = px - c.x;
  const dy = py - c.y;
  if (dx * c.sx >= 0 && dy * c.sy >= 0) {
    return Math.abs(Math.hypot(dx, dy) - r);
  }
  return Math.min(Math.hypot(dx - c.sx * r, dy), Math.hypot(dx, dy - c.sy * r));
}

// Distance from unit-space (x, y) to the mark's centre lines. The outline is
// `markDist(x, y) <= HALF_STROKE`; keeping the raw distance rather than a
// boolean is what lets the renderers antialias the edge exactly (see
// `renderIcon`), which matters for a 1.5 px stroke at favicon sizes.
function markDist(x, y) {
  let d = Math.abs(Math.hypot(x - HEAD.x, y - HEAD.y) - HEAD.r);
  for (const [ax, ay, bx, by] of SEGMENTS) {
    d = Math.min(d, distSegment(x, y, ax, ay, bx, by));
  }
  for (const c of CORNERS) d = Math.min(d, distCorner(x, y, c, CORNER_R));
  return d;
}

// How much of the pixel at unit-space (x, y) the stroke covers, given how many
// pixels one unit spans. Antialiasing straight from the signed distance — the
// same trick the rounded-rect background below uses, and exact for a stroke in
// a way supersampling only approximates.
function markCoverage(x, y, pxPerUnit) {
  return Math.max(
    0,
    Math.min(1, 0.5 - (markDist(x, y) - HALF_STROKE) * pxPerUnit),
  );
}

// Render size×size RGBA. The mark carries its own margin inside the 64-unit
// box, so `pad` is 0 by default and only the maskable icon insets further for
// its safe zone; `radius` rounds the background corners (0 = square, for
// maskable).
function renderIconRgba(size, { pad = 0, radius = 0.2 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const r = radius * size;
  // Pixels per unit of mark space, which is what turns the mark's distance
  // function into an antialiased edge.
  const pxPerUnit = size * (1 - 2 * pad);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      // Rounded-rect background coverage, from the shape's signed distance at
      // the pixel centre (negative inside). The straight-edge term matters:
      // without it a radius of 0 reads as "on the boundary" everywhere and the
      // whole square comes out half-transparent.
      const qx = Math.abs(px + 0.5 - size / 2) - (size / 2 - r);
      const qy = Math.abs(py + 0.5 - size / 2) - (size / 2 - r);
      const outside =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        r;
      const bgAlpha = Math.max(0, Math.min(1, 0.5 - outside));
      // Mark coverage at the pixel centre in padded unit space. The gradient
      // ink is sampled at that same height, so the mark shades top-to-bottom.
      const sx = ((px + 0.5) / size - pad) / (1 - 2 * pad);
      const sy = ((py + 0.5) / size - pad) / (1 - 2 * pad);
      const hit = markCoverage(sx, sy, pxPerUnit);
      const [br, bg2, bb] = BG;
      const [fr, fg2, fb] = markInk(sy);
      rgba[i] = Math.round(br + (fr - br) * hit);
      rgba[i + 1] = Math.round(bg2 + (fg2 - bg2) * hit);
      rgba[i + 2] = Math.round(bb + (fb - bb) * hit);
      rgba[i + 3] = Math.round(bgAlpha * 255);
    }
  }
  return rgba;
}

/** The same mark, encoded as a PNG. The desktop `.ico` below needs the raw
 *  pixels instead. */
function renderIcon(size, options) {
  return encodePng(size, size, renderIconRgba(size, options));
}

// The 1200×630 Open Graph card: the mark on the left, accent bars suggesting
// contact rows on the right.
function renderOg() {
  const w = 1200;
  const h = 630;
  const rgba = Buffer.alloc(w * h * 4);
  const markSize = 440;
  const markX = 120;
  const markY = (h - markSize) / 2;
  // The row bars pick up a mid-gradient accent so they sit with the mark.
  const BAR = markInk(0.5);
  const rows = [
    { x: 640, y: 200, w: 380, h: 26, a: 1 },
    { x: 640, y: 260, w: 300, h: 18, a: 0.55 },
    { x: 640, y: 320, w: 340, h: 18, a: 0.4 },
    { x: 640, y: 380, w: 260, h: 18, a: 0.55 },
    { x: 640, y: 440, w: 320, h: 18, a: 0.4 },
  ];
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      let [cr, cg, cb] = BG;
      // The person mark, stroked with the same gradient ink as the icons.
      if (
        px >= markX &&
        px < markX + markSize &&
        py >= markY &&
        py < markY + markSize
      ) {
        const sx = (px + 0.5 - markX) / markSize;
        const sy = (py + 0.5 - markY) / markSize;
        const hit = markCoverage(sx, sy, markSize);
        if (hit > 0) {
          const ink = markInk(sy);
          cr = Math.round(cr + (ink[0] - cr) * hit);
          cg = Math.round(cg + (ink[1] - cg) * hit);
          cb = Math.round(cb + (ink[2] - cb) * hit);
        }
      }
      // The row bars.
      for (const rrow of rows) {
        if (
          px >= rrow.x &&
          px < rrow.x + rrow.w &&
          py >= rrow.y &&
          py < rrow.y + rrow.h
        ) {
          cr = Math.round(BG[0] + (BAR[0] - BG[0]) * rrow.a);
          cg = Math.round(BG[1] + (BAR[1] - BG[1]) * rrow.a);
          cb = Math.round(BG[2] + (BAR[2] - BG[2]) * rrow.a);
        }
      }
      rgba[i] = cr;
      rgba[i + 1] = cg;
      rgba[i + 2] = cb;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(w, h, rgba);
}

writeFileSync(join(iconsDir, "pwa-192.png"), renderIcon(192));
writeFileSync(join(iconsDir, "pwa-512.png"), renderIcon(512));
writeFileSync(
  join(iconsDir, "pwa-512-maskable.png"),
  renderIcon(512, { pad: 0.1, radius: 0 }),
);
writeFileSync(
  join(iconsDir, "apple-touch-icon-180.png"),
  renderIcon(180, { radius: 0 }),
);
writeFileSync(join(root, "public", "og.png"), renderOg());

// The native wrapper's assets (native/assets), cut from the same mark so the
// app on a home screen and the PWA on a home screen are one product rather
// than two that resemble each other. Written here rather than kept as a
// separate set of files precisely so they cannot drift.
//   icon          — iOS wants a square, fully opaque icon and applies its own
//                   mask, so the tile is not pre-rounded.
//   adaptive-icon — Android masks the foreground to whatever shape the
//                   launcher uses, so the mark is inset to the safe zone and
//                   the tile runs to the edges (app.config.js paints the same
//                   ink behind it).
//   splash-icon   — the launch screen's mark, on the app's own surface, so
//                   this one keeps its rounded corners.
const nativeAssets = join(root, "native", "assets");
mkdirSync(nativeAssets, { recursive: true });
writeFileSync(join(nativeAssets, "icon.png"), renderIcon(1024, { radius: 0 }));
writeFileSync(
  join(nativeAssets, "adaptive-icon.png"),
  renderIcon(1024, { pad: 0.18, radius: 0 }),
);
writeFileSync(join(nativeAssets, "splash-icon.png"), renderIcon(512));

// favicon.ico — the browser-tab fallback for engines that ignore the SVG
// favicon (Safari, search crawlers) and for the implicit /favicon.ico request.
// Packs the mark at the three classic tab sizes. Lives at the public root so it
// deploys as `<base>favicon.ico` (see pwa-plugin.ts link tag).
writeFileSync(
  join(root, "public", "favicon.ico"),
  encodeIco([16, 32, 48].map((size) => ({ size, data: renderIcon(size) }))),
);
console.log(
  "icons: wrote pwa-192/512/512-maskable, apple-touch-180, og.png, favicon.ico, " +
    "native icon/adaptive-icon/splash-icon",
);

// The DESKTOP SHELL's icons (tauri/src-tauri/icons/), from the same geometry
// and the same ink as everything above — so the app in the dock, the tile on
// the home screen and the favicon in the tab are one mark rather than three
// that resemble each other.
//
// Two things make this a separate set rather than a reference to `public/`:
//
//   - **Tauri refuses a paletted PNG at COMPILE time**, inside
//     `generate_context!`, with `icon … is not RGBA`. These are RGBA (colour
//     type 6, see `encodePng`), so that is satisfied by construction here —
//     but it is why the sizes are re-rendered rather than symlinked to
//     whichever file happened to be the right shape.
//   - **`tauri-build` refuses a MISSING `icon.ico` outright** on a Windows
//     target ("required for generating a Windows Resource file"), and it must
//     be the DIB flavour a resource compiler can read — see `encodeIcoDib`.
//
// `radius: 0` throughout: every desktop draws its own mask over an app icon
// (macOS its squircle, Windows its square), so a tile that rounded its own
// corners first would sit inside a second rounding.
const tauriIconsDir = join(root, "tauri", "src-tauri", "icons");
mkdirSync(tauriIconsDir, { recursive: true });
const TAURI_SIZES = [32, 128, 256, 512];
for (const size of TAURI_SIZES) {
  writeFileSync(
    join(tauriIconsDir, `${size}x${size}.png`),
    renderIcon(size, { pad: 0.12, radius: 0 }),
  );
}
// Windows' own ladder: 16 and 32 are the ones actually drawn (the title bar,
// the taskbar, Explorer's small views), 48 is the shell's medium icon, and 256
// is what a large-icon view scales from. The three small ones are bitmaps and
// 256 is a PNG, which is the layout every Windows icon has worn since Vista —
// a 256 bitmap would be a quarter-megabyte of uncompressed BGRA in a file the
// repository carries, for the one size the format was extended to compress.
writeFileSync(
  join(tauriIconsDir, "icon.ico"),
  encodeIco([
    ...[16, 32, 48].map((size) => ({
      size,
      data: dibEntry(size, renderIconRgba(size, { pad: 0.08, radius: 0 })),
    })),
    { size: 256, data: renderIcon(256, { pad: 0.08, radius: 0 }) },
  ]),
);
console.log(`icons: wrote ${TAURI_SIZES.length} desktop icons + icon.ico`);
