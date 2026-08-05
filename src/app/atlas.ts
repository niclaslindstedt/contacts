// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The photo atlas: the *render tier* of the cloud photo layout.
//
// One file per photo is a lovely layout to browse and a hostile one to sync:
// a 300-contact book is ~840 files, and asking a cloud drive for them all on
// open is what provokes the `429`s and the browser-level connection failures
// `cloudRetry.ts` exists to survive. But look at what those files are *for*:
// the display crop is baked at 512 square and never drawn above 96 CSS px (the
// `hero` avatar — the lightbox shows `photoSource`, not the crop), and the
// source original isn't needed to open the app at all.
//
// So the transport is tiered. The **archival tier** stays exactly as it was —
// one real, previewable, deterministically-named JPEG per image (see
// `photoStore.ts`) — but is read *lazily*, only when a lightbox or the cropper
// asks for it. The **render tier** is this module: every crop re-encoded down
// to {@link TILE_PX} and batched into a handful of ZIP packs, which is what a
// device actually fetches on open. ~840 requests becomes ~7.
//
// A pack is immutable and content-addressed, and that is what makes the
// concurrency story a non-event — no lock files, no shared mutable index:
//
//   - A pack's id is the hash of its own bytes, so two devices either write
//     identical bytes to the same path or different bytes to different paths.
//     They can never collide, and no write needs a lease.
//   - The atlas is **derived and disposable** — every tile can be regenerated
//     from the archival tier — so it stays out of the synced document entirely.
//     Each pack carries its own `index.json` naming the contact and gallery
//     entry each tile belongs to, which makes it self-describing.
//   - A missing, stale, or corrupt tile is therefore never an error: it
//     degrades to a lazy read of that photo's archival file. The avatar is
//     never broken, only occasionally slower.
//
// Immutability has one cost, and it is the usual log-structured one: deleting or
// re-cropping a photo leaves a tile nothing reads inside a pack that is never
// rewritten. Two mechanisms clear it, both driven from the save path and both
// expressed here as pure set arithmetic — {@link deadPacks} drops a pack once
// nothing in it is live, and {@link sparsePacks} re-files the survivors of a
// pack that has gone mostly cold, which supersedes the rest of it and hands it
// to the first mechanism.
//
// This module is the pure half — paths, the index shape, building and parsing a
// pack, and deriving the wanted/dead sets — so it is node-testable end to end.
// The canvas downscale lives in `atlasTile.ts` (browser-only) and the transport
// in `atlasStore.ts`.

import { createZip, readZip } from "@niclaslindstedt/oss-framework/zip";

/** The side, in px, every atlas tile is re-encoded to. The largest an avatar is
 *  ever drawn is 96 CSS px (the framework's `xl`), so 96 × 3 covers a 3× device
 *  pixel ratio exactly — the densest phone, at the biggest size the app has. */
export const TILE_PX = 288;

/** JPEG quality the tiles are encoded at. They are a derived render cache whose
 *  full-resolution original is safe in the archival tier, so this can be
 *  cheerfully lossy. */
export const TILE_QUALITY = 0.8;

/** The subtree every atlas pack is filed under, inside the `photos/` root the
 *  archival tier already owns. */
export const ATLAS_ROOT = "photos/atlas";

/** Seal a pack once it reaches this many bytes. Small enough that a device
 *  missing one photo doesn't drag down a huge archive, big enough that a whole
 *  address book is a handful of requests. */
export const PACK_TARGET_BYTES = 4_000_000;

/** The file inside a pack that says what the pack holds. */
const PACK_INDEX = "index.json";

/** What one tile is: the gallery entry it renders, and a fingerprint of the
 *  full-resolution crop it was derived from — so a device holding those bytes
 *  can tell whether the filed tile is still current without downloading it. */
export type AtlasTile = {
  contactId: string;
  entryId: string;
  /** {@link srcFingerprint} of the crop this tile was baked from. */
  src: string;
};

/** A pack's self-describing index: every tile in it, keyed by content hash
 *  (which is also the tile's entry name inside the ZIP). */
export type AtlasIndex = {
  version: 1;
  tiles: Record<string, AtlasTile>;
};

/** A pack as this module deals in it: where it lives, what it holds, and the
 *  monotonic sequence its name carries (see {@link atlasPackPath}). */
export type AtlasPack = {
  path: string;
  seq: number;
  index: AtlasIndex;
};

/** One tile ready to be filed: its content hash, its JPEG bytes, and what it
 *  renders. */
export type PendingTile = {
  hash: string;
  bytes: Uint8Array;
  tile: AtlasTile;
};

/** The identity of the *thing a tile renders* — one gallery entry of one
 *  contact. Two tiles sharing a key are the same photo at different revisions
 *  (a re-crop), and the newer pack's wins. */
export function tileKey(contactId: string, entryId: string): string {
  return `${contactId} ${entryId}`;
}

/** A cheap 32-bit fingerprint (djb2) of a crop's data URI — the same shape
 *  `photoStore.ts` uses to skip needless re-uploads. Recorded in the pack index
 *  so a re-crop is detected without comparing image bytes. */
export function srcFingerprint(dataUrl: string): string {
  let h = 5381;
  for (let i = 0; i < dataUrl.length; i += 1) {
    h = (h * 33) ^ dataUrl.charCodeAt(i);
  }
  return `${dataUrl.length}:${(h >>> 0).toString(36)}`;
}

/** The content hash a tile is stored under: SHA-256 of its bytes, truncated to
 *  16 hex chars. Long enough that a collision across one address book is not a
 *  thing that happens, short enough to read in a file listing. */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.slice().buffer as ArrayBuffer,
  );
  const view = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 8; i += 1) {
    hex += view[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Where a pack lives: `photos/atlas/<seq>-<id>.zip`.
 *
 *  The `id` is the hash of the pack's own bytes, which is what makes a pack
 *  immutable and collision-proof. The `seq` in front is a plain monotonic
 *  counter that gives packs an *order*, so when two packs hold a tile for the
 *  same gallery entry (a photo that was re-cropped) the reader knows which is
 *  newer. Two devices that pick the same sequence write different ids, so both
 *  files survive and the tie breaks on the id — deterministically, and the same
 *  way on every device. */
export function atlasPackPath(seq: number, id: string): string {
  return `${ATLAS_ROOT}/${String(seq).padStart(4, "0")}-${id}.zip`;
}

/** Whether a path names an atlas pack (rather than an archival photo file). */
export function isAtlasPath(path: string): boolean {
  return parseAtlasPath(path) !== null;
}

/** Pull the sequence and id back out of a pack path, or null when the path
 *  isn't one. */
export function parseAtlasPath(
  path: string,
): { seq: number; id: string } | null {
  const match = new RegExp(`^${ATLAS_ROOT}/(\\d+)-([0-9a-f]+)\\.zip$`).exec(
    path,
  );
  if (!match) return null;
  return { seq: Number(match[1]), id: match[2]! };
}

/** The sequence a newly-sealed pack should carry: one past the highest already
 *  filed. */
export function nextSeq(paths: readonly string[]): number {
  let max = 0;
  for (const path of paths) {
    const parsed = parseAtlasPath(path);
    if (parsed && parsed.seq > max) max = parsed.seq;
  }
  return max + 1;
}

/** Order packs oldest-first, so a later pack's tile overwrites an earlier one's
 *  for the same gallery entry. Ties (two devices, same sequence) break on the
 *  id, which every device resolves identically. */
export function sortPacks<T extends { path: string }>(
  packs: readonly T[],
): T[] {
  return [...packs].sort((a, b) => {
    const pa = parseAtlasPath(a.path);
    const pb = parseAtlasPath(b.path);
    if (!pa || !pb) return a.path.localeCompare(b.path);
    return pa.seq - pb.seq || pa.id.localeCompare(pb.id);
  });
}

// --- building and parsing a pack ---------------------------------------------

/** Every pack this module writes is stamped with the same fixed mtime, so a
 *  given set of tiles always produces byte-identical bytes — and therefore the
 *  same pack id — no matter which device or which day built it. Without this,
 *  two devices filing the same photo would write two differently-named packs
 *  holding identical content. */
const FIXED_MTIME = new Date(0);

/** Build a pack from a set of tiles: a ZIP holding `index.json` plus one JPEG
 *  per tile, named by its content hash. Returns the pack's bytes and the id
 *  (hash of those bytes) its path is built from. */
export async function buildPack(
  tiles: readonly PendingTile[],
): Promise<{ id: string; bytes: Uint8Array; index: AtlasIndex }> {
  const index: AtlasIndex = { version: 1, tiles: {} };
  // Sorted so the archive's entry order depends only on *what* is in the pack,
  // never on the order the caller happened to collect it in.
  const sorted = [...tiles].sort((a, b) => a.hash.localeCompare(b.hash));
  for (const t of sorted) index.tiles[t.hash] = t.tile;
  const entries = [
    { name: PACK_INDEX, data: encodeText(JSON.stringify(index)) },
    ...sorted.map((t) => ({ name: `${t.hash}.jpg`, data: t.bytes })),
  ];
  const bytes = await createZip(entries, FIXED_MTIME);
  return { id: await hashBytes(bytes), bytes, index };
}

/** Read a pack's index without its tile bytes — enough to decide whether the
 *  pack is worth downloading, or whether it is dead. Throws on anything that
 *  isn't a readable pack; callers treat that as a failed read, never as
 *  "these photos are gone". */
export async function readPackIndex(bytes: Uint8Array): Promise<AtlasIndex> {
  const entries = await readZip(bytes);
  const raw = entries.find((e) => e.name === PACK_INDEX);
  if (!raw) throw new Error("atlas pack has no index");
  return parseIndex(decodeText(raw.data));
}

/** Read a pack in full: its index plus every tile's JPEG bytes, keyed by hash. */
export async function readPack(
  bytes: Uint8Array,
): Promise<{ index: AtlasIndex; tiles: Map<string, Uint8Array> }> {
  const entries = await readZip(bytes);
  const raw = entries.find((e) => e.name === PACK_INDEX);
  if (!raw) throw new Error("atlas pack has no index");
  const index = parseIndex(decodeText(raw.data));
  const tiles = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.name === PACK_INDEX) continue;
    const hash = entry.name.replace(/\.jpg$/i, "");
    if (index.tiles[hash]) tiles.set(hash, entry.data);
  }
  return { index, tiles };
}

/** Validate a parsed index, so a truncated or hand-edited file is rejected as a
 *  bad pack rather than half-adopted. */
function parseIndex(text: string): AtlasIndex {
  const doc = JSON.parse(text) as Partial<AtlasIndex>;
  if (doc.version !== 1 || typeof doc.tiles !== "object" || !doc.tiles) {
    throw new Error("atlas pack index is not readable");
  }
  const tiles: Record<string, AtlasTile> = {};
  for (const [hash, tile] of Object.entries(doc.tiles)) {
    if (
      tile &&
      typeof tile.contactId === "string" &&
      typeof tile.entryId === "string" &&
      typeof tile.src === "string"
    ) {
      tiles[hash] = tile;
    }
  }
  return { version: 1, tiles };
}

// --- deriving what the atlas should hold --------------------------------------

/** One gallery entry, named the way a tile names it. */
export type GalleryEntry = { contactId: string; entryId: string };

/** A gallery entry this device holds the full-resolution crop for — the only
 *  kind of entry a tile can be baked from. */
export type InlineCrop = GalleryEntry & { dataUrl: string };

/** What the atlas needs to know about an outgoing document: which gallery
 *  entries exist at all (which is what keeps a pack alive), and which of them
 *  this device is holding crop bytes for (which is what can be baked).
 *
 *  Both are collected in the single walk the externaliser already makes over
 *  the outgoing document, so the atlas costs no extra parse of a document that
 *  can be megabytes of inline image data. */
export type AtlasInput = {
  entries: GalleryEntry[];
  inline: InlineCrop[];
};

/** Which tiles the packs *already* hold, newest write per gallery entry.
 *  Packs are folded oldest-first, so a re-crop's later pack replaces the
 *  earlier tile for that entry. */
export function currentTiles(
  packs: readonly AtlasPack[],
): Map<string, { hash: string; path: string; tile: AtlasTile }> {
  const out = new Map<
    string,
    { hash: string; path: string; tile: AtlasTile }
  >();
  for (const pack of sortPacks(packs)) {
    for (const [hash, tile] of Object.entries(pack.index.tiles)) {
      out.set(tileKey(tile.contactId, tile.entryId), {
        hash,
        path: pack.path,
        tile,
      });
    }
  }
  return out;
}

/** Which gallery entries need a tile baked and filed: every photo this device
 *  holds full-resolution bytes for whose filed tile is missing or was baked
 *  from different bytes (a re-crop).
 *
 *  Keyed off *inline* bytes on purpose. A device that opened the book and only
 *  hydrated tiles holds no crops, so it derives an empty set and quietly writes
 *  nothing — it can't mistake "I don't have these bytes" for "these tiles need
 *  rewriting". */
export function staleTiles(
  inline: readonly InlineCrop[],
  current: ReadonlyMap<string, { tile: AtlasTile }>,
): (InlineCrop & { src: string })[] {
  const out: (InlineCrop & { src: string })[] = [];
  for (const crop of inline) {
    const src = srcFingerprint(crop.dataUrl);
    const filed = current.get(tileKey(crop.contactId, crop.entryId));
    if (filed?.tile.src === src) continue;
    out.push({ ...crop, src });
  }
  return out;
}

/** Whether one of a pack's tiles is *the* tile a reader would use: its gallery
 *  entry still exists, and no later pack has superseded it. This is the unit of
 *  liveness the prune and the rebuild both count.
 *
 *  Note what it does *not* consult: which bytes this device happens to hold.
 *  Liveness comes from the document's gallery entries and the packs' own
 *  indexes, so a device that opened the book without its photos computes the
 *  same answer as the one that took them. */
function isLiveTile(
  pack: AtlasPack,
  hash: string,
  tile: AtlasTile,
  live: ReadonlySet<string>,
  current: ReadonlyMap<string, { hash: string; path: string }>,
): boolean {
  const key = tileKey(tile.contactId, tile.entryId);
  if (!live.has(key)) return false;
  const winner = current.get(key);
  return winner?.path === pack.path && winner.hash === hash;
}

/** How much of each pack is still worth keeping: the share of its tiles that
 *  are live (see {@link isLiveTile}). Tiles are near-uniform in size — one
 *  288 px JPEG each — so counting them is a good enough stand-in for bytes, and
 *  it needs nothing the pack indexes don't already carry. */
export function packLiveness(
  entries: readonly GalleryEntry[],
  packs: readonly AtlasPack[],
): Map<string, { live: number; total: number; fraction: number }> {
  const live = new Set(entries.map((e) => tileKey(e.contactId, e.entryId)));
  const current = currentTiles(packs);
  const out = new Map<
    string,
    { live: number; total: number; fraction: number }
  >();
  for (const pack of packs) {
    const tiles = Object.entries(pack.index.tiles);
    const alive = tiles.filter(([hash, tile]) =>
      isLiveTile(pack, hash, tile, live, current),
    ).length;
    out.set(pack.path, {
      live: alive,
      total: tiles.length,
      fraction: tiles.length === 0 ? 0 : alive / tiles.length,
    });
  }
  return out;
}

/** Packs nothing would read any more: every tile in them either names a gallery
 *  entry the document no longer has, or has been superseded by a later pack's
 *  tile for the same entry.
 *
 *  A pack keeps its place while *one* of its tiles is still the live one, so
 *  this only ever removes whole packs that have gone completely cold — the
 *  partially-superseded ones are the rebuild's business ({@link sparsePacks}). */
export function deadPacks(
  entries: readonly GalleryEntry[],
  packs: readonly AtlasPack[],
): string[] {
  const liveness = packLiveness(entries, packs);
  return packs
    .filter((pack) => (liveness.get(pack.path)?.live ?? 0) === 0)
    .map((pack) => pack.path);
}

/** Rebuild a pack once this share of its tiles has gone cold. Half is a
 *  deliberately lazy threshold: a rebuild costs an upload and a delete, and a
 *  superseded tile costs ~15 KB nobody ever reads, so there is no hurry. */
export const COMPACT_BELOW = 0.5;

/** Packs worth rebuilding, and the crops to rebuild them from.
 *
 *  A pack is never rewritten in place — it is immutable, which is what makes it
 *  collision-proof. "Compaction" is therefore just *re-filing* the live tiles of
 *  a mostly-cold pack into a fresh one: that supersedes every tile the old pack
 *  held, which makes it dead, and {@link deadPacks} then removes it on the same
 *  save. So the whole rebuild is expressed as extra work for the existing write
 *  path, and nothing has to download a pack to repack it.
 *
 *  Two rules keep it from ever being a net loss:
 *
 *    - **Only a pack this device can wholly replace.** Every one of its live
 *      tiles must have an inline crop here to re-bake from. Re-filing only some
 *      of them would leave the rest live, so the old pack would survive and the
 *      new bytes would be pure addition. A device that hydrated tiles rather
 *      than crops therefore compacts nothing at all.
 *    - **Only a pack that has actually gone cold**, below
 *      {@link COMPACT_BELOW}. */
export function sparsePacks(
  entries: readonly GalleryEntry[],
  inline: readonly InlineCrop[],
  packs: readonly AtlasPack[],
): { paths: string[]; refile: InlineCrop[] } {
  const live = new Set(entries.map((e) => tileKey(e.contactId, e.entryId)));
  const current = currentTiles(packs);
  const byKey = new Map(
    inline.map((c) => [tileKey(c.contactId, c.entryId), c] as const),
  );
  const liveness = packLiveness(entries, packs);
  const paths: string[] = [];
  const refile: InlineCrop[] = [];

  for (const pack of packs) {
    const stats = liveness.get(pack.path);
    // A pack with nothing live is the prune's job, not the rebuild's.
    if (!stats || stats.live === 0 || stats.fraction >= COMPACT_BELOW) continue;
    const crops: InlineCrop[] = [];
    let replaceable = true;
    for (const [hash, tile] of Object.entries(pack.index.tiles)) {
      if (!isLiveTile(pack, hash, tile, live, current)) continue;
      const crop = byKey.get(tileKey(tile.contactId, tile.entryId));
      if (!crop) {
        replaceable = false;
        break;
      }
      crops.push(crop);
    }
    if (!replaceable) continue;
    paths.push(pack.path);
    refile.push(...crops);
  }
  return { paths, refile };
}

/** Split tiles into packs of at most {@link PACK_TARGET_BYTES}, so one pack is
 *  never so large that a device fetches megabytes to see one new face. */
export function batchTiles(tiles: readonly PendingTile[]): PendingTile[][] {
  const batches: PendingTile[][] = [];
  let batch: PendingTile[] = [];
  let size = 0;
  for (const tile of tiles) {
    if (batch.length > 0 && size + tile.bytes.length > PACK_TARGET_BYTES) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(tile);
    size += tile.bytes.length;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
