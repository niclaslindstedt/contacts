// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  PACK_TARGET_BYTES,
  atlasPackPath,
  batchTiles,
  buildPack,
  currentTiles,
  deadPacks,
  hashBytes,
  isAtlasPath,
  nextSeq,
  parseAtlasPath,
  readPack,
  readPackIndex,
  sortPacks,
  srcFingerprint,
  staleTiles,
  tileKey,
  type AtlasPack,
  type PendingTile,
} from "../src/app/atlas.ts";
import { applyTiles } from "../src/app/atlasStore.ts";

/** Bytes that don't compress, so a pack stores them verbatim the way real JPEG
 *  tiles are stored. */
function bytes(seed: number, length = 64): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed * 2654435761;
  for (let i = 0; i < length; i += 1) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = x & 0xff;
  }
  return out;
}

async function tile(
  contactId: string,
  entryId: string,
  seed: number,
  src = `src-${seed}`,
  length = 64,
): Promise<PendingTile> {
  const data = bytes(seed, length);
  return {
    hash: await hashBytes(data),
    bytes: data,
    tile: { contactId, entryId, src },
  };
}

function pack(
  path: string,
  tiles: Record<string, [string, string, string]>,
): AtlasPack {
  return {
    path,
    seq: parseAtlasPath(path)?.seq ?? 0,
    index: {
      version: 1,
      tiles: Object.fromEntries(
        Object.entries(tiles).map(([hash, [contactId, entryId, src]]) => [
          hash,
          { contactId, entryId, src },
        ]),
      ),
    },
  };
}

describe("hashBytes", () => {
  it("is stable, short, and content-dependent", async () => {
    const a = await hashBytes(bytes(1));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await hashBytes(bytes(1))).toBe(a);
    expect(await hashBytes(bytes(2))).not.toBe(a);
  });
});

describe("pack paths", () => {
  it("round-trips the sequence and the id", () => {
    const path = atlasPackPath(7, "abcdef0123456789");
    expect(path).toBe("photos/atlas/0007-abcdef0123456789.zip");
    expect(parseAtlasPath(path)).toEqual({ seq: 7, id: "abcdef0123456789" });
    expect(isAtlasPath(path)).toBe(true);
  });

  it("does not claim an archival photo file", () => {
    // The archival tier lives in the same `photos/` tree, so the two namings
    // have to stay tellable apart — the prune leans on exactly this.
    expect(isAtlasPath("photos/ada-lovelace-4k2p-1.jpg")).toBe(false);
    expect(isAtlasPath("photos/ada-lovelace-4k2p-1-source.jpg")).toBe(false);
    expect(isAtlasPath("photos/atlas/notapack.txt")).toBe(false);
  });

  it("takes the next sequence past the highest filed", () => {
    expect(nextSeq([])).toBe(1);
    expect(
      nextSeq([atlasPackPath(1, "aa"), atlasPackPath(9, "bb"), "photos/x.jpg"]),
    ).toBe(10);
  });
});

describe("buildPack / readPack", () => {
  it("round-trips tile bytes exactly and keeps the index", async () => {
    const tiles = [await tile("c1", "p1", 1), await tile("c2", "p2", 2)];
    const built = await buildPack(tiles);
    const read = await readPack(built.bytes);
    for (const t of tiles) {
      expect(read.tiles.get(t.hash)).toEqual(t.bytes);
      expect(read.index.tiles[t.hash]).toEqual(t.tile);
    }
  });

  it("reads the index alone the same way", async () => {
    const tiles = [await tile("c1", "p1", 3)];
    const built = await buildPack(tiles);
    expect(await readPackIndex(built.bytes)).toEqual(built.index);
  });

  it("is deterministic, so two devices filing the same tiles agree", async () => {
    // The pack id is the hash of its own bytes, which is what makes packs
    // immutable and collision-proof — so the bytes must not depend on the order
    // the caller collected the tiles in, or on when it built them.
    const a = await tile("c1", "p1", 4);
    const b = await tile("c2", "p2", 5);
    const one = await buildPack([a, b]);
    const two = await buildPack([b, a]);
    expect(two.id).toBe(one.id);
    expect(two.bytes).toEqual(one.bytes);
  });

  it("rejects bytes that are not a readable pack", async () => {
    await expect(readPack(bytes(6, 200))).rejects.toThrow();
  });
});

describe("currentTiles", () => {
  it("lets a later pack's tile win for the same gallery entry", () => {
    // A re-crop files a new tile for an entry that already had one; the newer
    // pack is the one whose tile should be shown.
    const packs = [
      pack(atlasPackPath(1, "aa"), { h1: ["c1", "p1", "old"] }),
      pack(atlasPackPath(2, "bb"), { h2: ["c1", "p1", "new"] }),
    ];
    const current = currentTiles(packs);
    expect(current.get(tileKey("c1", "p1"))?.hash).toBe("h2");
  });

  it("breaks a sequence tie on the id, so every device resolves it alike", () => {
    const packs = [
      pack(atlasPackPath(3, "bbbb"), { h2: ["c1", "p1", "b"] }),
      pack(atlasPackPath(3, "aaaa"), { h1: ["c1", "p1", "a"] }),
    ];
    expect(currentTiles(packs).get(tileKey("c1", "p1"))?.hash).toBe("h2");
    expect(sortPacks(packs).map((p) => p.path)).toEqual([
      atlasPackPath(3, "aaaa"),
      atlasPackPath(3, "bbbb"),
    ]);
  });
});

describe("staleTiles", () => {
  const current = currentTiles([
    pack(atlasPackPath(1, "aa"), {
      h1: ["c1", "p1", srcFingerprint("crop-1")],
    }),
  ]);

  it("skips a photo whose filed tile was baked from these very bytes", () => {
    const stale = staleTiles(
      [{ contactId: "c1", entryId: "p1", dataUrl: "crop-1" }],
      current,
    );
    expect(stale).toEqual([]);
  });

  it("re-bakes a photo that was re-cropped", () => {
    const stale = staleTiles(
      [{ contactId: "c1", entryId: "p1", dataUrl: "crop-2" }],
      current,
    );
    expect(stale.map((s) => s.entryId)).toEqual(["p1"]);
  });

  it("bakes a photo the atlas has never seen", () => {
    const stale = staleTiles(
      [{ contactId: "c9", entryId: "p9", dataUrl: "crop-9" }],
      current,
    );
    expect(stale.map((s) => s.contactId)).toEqual(["c9"]);
  });

  it("writes nothing for a device holding no crops", () => {
    // The whole point of keying off inline bytes: a device that opened the book
    // and only hydrated tiles must not mistake "I don't have these" for "these
    // need rewriting".
    expect(staleTiles([], current)).toEqual([]);
  });
});

describe("deadPacks", () => {
  const packs = [
    pack(atlasPackPath(1, "aa"), {
      h1: ["c1", "p1", "s"],
      h2: ["c2", "p2", "s"],
    }),
    pack(atlasPackPath(2, "bb"), { h3: ["c3", "p3", "s"] }),
    pack(atlasPackPath(3, "cc"), {}),
  ];

  it("keeps a pack while any one of its tiles is still wanted", () => {
    const dead = deadPacks([{ contactId: "c1", entryId: "p1" }], packs);
    expect(dead).toContain(atlasPackPath(2, "bb"));
    expect(dead).not.toContain(atlasPackPath(1, "aa"));
  });

  it("drops a pack holding nothing any contact still has an entry for", () => {
    expect(deadPacks([], packs)).toEqual([
      atlasPackPath(1, "aa"),
      atlasPackPath(2, "bb"),
      atlasPackPath(3, "cc"),
    ]);
  });

  it("judges liveness from gallery entries, never from held bytes", () => {
    // An entry with no bytes on this device still keeps its pack — otherwise a
    // device that opened the book without its photos would prune the atlas.
    const dead = deadPacks(
      [
        { contactId: "c1", entryId: "p1" },
        { contactId: "c3", entryId: "p3" },
      ],
      packs,
    );
    expect(dead).toEqual([atlasPackPath(3, "cc")]);
  });
});

describe("batchTiles", () => {
  it("keeps a pack under the target size", async () => {
    const big = Math.floor(PACK_TARGET_BYTES / 2) + 1;
    const tiles = [
      await tile("c1", "p1", 1, "s", big),
      await tile("c2", "p2", 2, "s", big),
      await tile("c3", "p3", 3, "s", big),
    ];
    expect(batchTiles(tiles).map((b) => b.length)).toEqual([1, 1, 1]);
  });

  it("packs small tiles together", async () => {
    const tiles = [await tile("c1", "p1", 1), await tile("c2", "p2", 2)];
    expect(batchTiles(tiles)).toHaveLength(1);
  });

  it("never emits an empty pack", () => {
    expect(batchTiles([])).toEqual([]);
  });
});

describe("applyTiles", () => {
  it("gives an entry with no crop a face", () => {
    const doc = { contacts: [{ id: "c1", photos: [{ id: "p1" }] }] };
    expect(
      applyTiles(doc, new Map([[tileKey("c1", "p1"), "tile-bytes"]])),
    ).toBe(1);
    expect(doc.contacts[0]!.photos[0]).toEqual({
      id: "p1",
      photoTile: "tile-bytes",
    });
  });

  it("leaves a full-resolution crop alone", () => {
    // A tile must never displace the crop it was downscaled from — that copy is
    // what the archival file holds and what a re-crop needs.
    const doc = {
      contacts: [{ id: "c1", photos: [{ id: "p1", photo: "crop" }] }],
    };
    expect(applyTiles(doc, new Map([[tileKey("c1", "p1"), "tile"]]))).toBe(0);
    expect(doc.contacts[0]!.photos[0]!.photo).toBe("crop");
  });

  it("ignores a tile whose gallery entry is gone", () => {
    const doc = { contacts: [{ id: "c1", photos: [{ id: "p1" }] }] };
    expect(applyTiles(doc, new Map([[tileKey("c1", "gone"), "tile"]]))).toBe(0);
  });
});
