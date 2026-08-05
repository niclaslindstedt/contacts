// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Moving the photo atlas over a backend: the transport half of `atlas.ts`.
//
// `atlas.ts` owns the format and the decisions (what a pack is, which tiles are
// stale, which packs are dead); this module owns the round-trips — listing the
// `photos/atlas/` tree, reading packs, baking and writing new ones, and
// removing dead ones — over the same {@link PhotoStore} byte transport the
// archival tier already drives, so it inherits the bounded concurrency and the
// `Retry-After` handling in `cloudRetry.ts` for free.
//
// Every operation here is **best-effort and non-fatal**. The atlas is a derived
// render cache: a pack that won't read, won't write, or won't parse costs a few
// contacts a lazy archival fetch and nothing else. So nothing in this module
// throws at its caller, and nothing it does can put a photo at risk — the
// archival tier is written first and independently (see `photoStore.ts`).
//
// The pack indexes are cached across a session, because reading one means
// downloading the whole pack (a ZIP is only readable in full). A device that
// just opened the book therefore has a warm cache, and a save costs one listing
// plus at most one upload.

import { bytesToDataUrl } from "@niclaslindstedt/oss-framework/files";

import {
  atlasPackPath,
  batchTiles,
  buildPack,
  currentTiles,
  deadPacks,
  hashBytes,
  isAtlasPath,
  nextSeq,
  readPack,
  staleTiles,
  tileKey,
  type AtlasInput,
  type AtlasPack,
  type PendingTile,
} from "./atlas.ts";
import { bakeTile } from "./atlasTile.ts";
import { MEDIA_CONCURRENCY, mapLimit } from "./cloudRetry.ts";
import { logStore } from "./log.ts";
import type { PhotoStore } from "./photoStore.ts";

const log = logStore.createLogger("photos");

/** The atlas as its callers use it: read the render tier on load, bring it back
 *  in step on save. */
export type Atlas = {
  /** Every filed tile, keyed by {@link tileKey}, as a `data:` URL ready to hang
   *  on a gallery entry. Empty when the backend has no atlas (or can't be
   *  read) — the caller then falls back to the archival tier. */
  read(): Promise<Map<string, string>>;
  /** File tiles for any photo whose crop this device holds and the atlas is
   *  missing or has an outdated copy of, then drop packs no surviving contact
   *  wants. */
  sync(input: AtlasInput): Promise<void>;
};

export function createAtlas(photos: PhotoStore): Atlas {
  // path → the pack's index. Cached because reading an index means downloading
  // the whole pack, and a save shouldn't have to re-download what the load it
  // followed already read.
  const known = new Map<string, AtlasPack>();

  /** The atlas paths currently on the backend, or null when the listing failed
   *  (which stands every atlas operation down rather than guessing). */
  async function list(): Promise<string[] | null> {
    try {
      return (await photos.list()).filter(isAtlasPath);
    } catch (err) {
      log.warn(`atlas: could not list packs (${errMsg(err)})`);
      return null;
    }
  }

  /** Read and cache the indexes of any packs this session hasn't seen, and
   *  forget ones that have since been removed. Returns the live pack set. */
  async function refresh(paths: readonly string[]): Promise<AtlasPack[]> {
    const wanted = new Set(paths);
    for (const path of [...known.keys()]) {
      if (!wanted.has(path)) known.delete(path);
    }
    const missing = paths.filter((p) => !known.has(p));
    await mapLimit(missing, MEDIA_CONCURRENCY, async (path) => {
      const pack = await readOne(path);
      if (pack) known.set(path, { path, seq: 0, index: pack.index });
    });
    return [...known.values()];
  }

  /** Download and parse one pack. Null on any failure — a pack that can't be
   *  read is treated as absent, never as a set of deleted photos. */
  async function readOne(path: string) {
    try {
      const bytes = await photos.read(path);
      if (!bytes) return null;
      return await readPack(bytes);
    } catch (err) {
      log.warn(`atlas: could not read ${path} (${errMsg(err)})`);
      return null;
    }
  }

  return {
    async read() {
      const out = new Map<string, string>();
      const paths = await list();
      if (!paths || paths.length === 0) return out;

      // Read every pack once, keeping both its index (cached for the next save)
      // and its tile bytes (needed right now).
      const loaded = await mapLimit(paths, MEDIA_CONCURRENCY, async (path) => {
        const pack = await readOne(path);
        if (!pack) return null;
        known.set(path, { path, seq: 0, index: pack.index });
        return { path, ...pack };
      });
      const packs = loaded.filter((p) => p !== null);
      if (packs.length === 0) return out;

      // `currentTiles` resolves the newest tile per gallery entry across packs,
      // so a re-cropped photo lands on the tile its latest pack carries.
      const byPath = new Map(packs.map((p) => [p.path, p.tiles] as const));
      for (const [key, { hash, path }] of currentTiles(
        packs.map((p) => ({ path: p.path, seq: 0, index: p.index })),
      )) {
        const bytes = byPath.get(path)?.get(hash);
        if (bytes) out.set(key, bytesToDataUrl("image/jpeg", bytes));
      }
      log.info(
        `atlas: read ${out.size} tile(s) from ${packs.length} pack(s) ` +
          `(${paths.length} filed)`,
      );
      return out;
    },

    async sync(input) {
      const paths = await list();
      if (!paths) return;
      const packs = await refresh(paths);

      // 1. File tiles for crops this device holds that the atlas lacks (or
      //    holds an outdated bake of). A device that only hydrated tiles holds
      //    no crops and so derives an empty set — it writes nothing.
      const stale = staleTiles(input.inline, currentTiles(packs));
      if (stale.length > 0) {
        const baked = await mapLimit(
          stale,
          MEDIA_CONCURRENCY,
          async (entry): Promise<PendingTile | null> => {
            const bytes = await bakeTile(entry.dataUrl);
            if (!bytes) return null;
            return {
              hash: await hashBytes(bytes),
              bytes,
              tile: {
                contactId: entry.contactId,
                entryId: entry.entryId,
                src: entry.src,
              },
            };
          },
        );
        const tiles = baked.filter((t) => t !== null);
        let seq = nextSeq(paths);
        for (const batch of batchTiles(tiles)) {
          try {
            const pack = await buildPack(batch);
            const path = atlasPackPath(seq, pack.id);
            await photos.write(path, pack.bytes, "application/zip");
            known.set(path, { path, seq, index: pack.index });
            paths.push(path);
            seq += 1;
            log.info(`atlas: filed ${batch.length} tile(s) as ${path}`);
          } catch (err) {
            // Nothing is lost — the archival file for each of these photos is
            // already written, so a reader just fetches it lazily instead.
            log.warn(`atlas: could not file a pack (${errMsg(err)})`);
          }
        }
      }

      // 2. Drop packs holding nothing any surviving contact still wants.
      const dead = deadPacks(input.entries, [...known.values()]);
      if (dead.length === 0) return;
      log.info(`atlas: dropping ${dead.length} pack(s) with no live tiles`);
      await mapLimit(dead, MEDIA_CONCURRENCY, (path) =>
        photos
          .remove(path)
          .then(() => {
            known.delete(path);
          })
          .catch((err: unknown) => {
            log.warn(`atlas: could not remove ${path} (${errMsg(err)})`);
          }),
      );
    },
  };
}

/** Hang each filed tile on the gallery entry it renders, for entries this copy
 *  has no full-resolution crop for. Mutates `doc` in place and returns how many
 *  were applied.
 *
 *  A tile only ever fills {@link ContactPhoto.photoTile}, never `photo`. Keeping
 *  the derived downscale in its own field is what stops it from ever being
 *  written back over the archival file it was baked from — the externaliser
 *  files out `photo`, sees nothing here, and leaves the full-resolution copy on
 *  the drive alone. */
export function applyTiles(
  doc: {
    contacts?: {
      id: string;
      photos?: {
        id: string;
        photo?: string | null;
        photoTile?: string | null;
      }[];
    }[];
  },
  tiles: ReadonlyMap<string, string>,
): number {
  if (tiles.size === 0) return 0;
  let applied = 0;
  for (const contact of doc.contacts ?? []) {
    for (const entry of contact.photos ?? []) {
      if (entry.photo) continue;
      const tile = tiles.get(tileKey(contact.id, entry.id));
      if (tile && entry.photoTile !== tile) {
        entry.photoTile = tile;
        applied += 1;
      }
    }
  }
  return applied;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
