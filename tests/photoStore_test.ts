// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRANSFER_CONCURRENCY,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

import { photoPathFor, photoSourcePathFor } from "../src/app/photo.ts";
import { atlasPackPath } from "../src/app/atlas.ts";
import { withExternalPhotos, type PhotoStore } from "../src/app/photoStore.ts";

// A one-pixel-ish JPEG stand-in: any decodable `image/jpeg` data URI will do.
const JPEG = "data:image/jpeg;base64,SGVsbG8=";
const OTHER_JPEG = "data:image/jpeg;base64,V29ybGQ=";

const ADA = { id: "c1", firstName: "Ada", lastName: "Lovelace" };
const ADA_PHOTO = photoPathFor(ADA, 1);
const ADA_SOURCE = photoSourcePathFor(ADA, 1);

/** A fake byte store backed by a Map, with hooks a test can use to make one
 *  path fail and to watch how many reads/writes are in flight at once. */
function fakeStore(fail: { read?: Set<string>; write?: Set<string> } = {}): {
  store: PhotoStore;
  files: Map<string, Uint8Array>;
  removed: string[];
  reads: string[];
  peakInFlight: () => number;
} {
  const files = new Map<string, Uint8Array>();
  const removed: string[] = [];
  const reads: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const enter = async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await Promise.resolve();
    await Promise.resolve();
    inFlight -= 1;
  };
  const store: PhotoStore = {
    async list() {
      return [...files.keys()];
    },
    async read(path) {
      await enter();
      reads.push(path);
      if (fail.read?.has(path)) throw new TypeError("Load failed");
      return files.get(path) ?? null;
    },
    async write(path, bytes) {
      await enter();
      if (fail.write?.has(path)) throw new TypeError("Load failed");
      files.set(path, bytes);
    },
    async remove(path) {
      removed.push(path);
      files.delete(path);
    },
  };
  return { store, files, removed, reads, peakInFlight: () => peak };
}

/** A minimal in-memory inner adapter: `save` keeps the last text, `load`
 *  returns it. */
function fakeInner(initial: string | null = null) {
  const state = { text: initial };
  const adapter = {
    id: "test",
    label: "Test",
    async load() {
      return state.text === null ? null : { text: state.text, revision: "r1" };
    },
    async save(text: string) {
      state.text = text;
      return { revision: "r2" };
    },
  };
  return { adapter: adapter as unknown as StorageAdapter, state };
}

type TestPhoto = Record<string, unknown> & { id: string };

function docWith(
  photos: TestPhoto[],
  contact: Partial<typeof ADA> = {},
): string {
  return JSON.stringify({
    version: 4,
    folders: [],
    activeContactId: "c1",
    contacts: [
      {
        ...ADA,
        ...contact,
        phones: [],
        emails: [],
        addresses: [],
        importantDates: [],
        folderId: null,
        photos,
      },
    ],
  });
}

function photosOf(text: string): TestPhoto[] {
  const doc = JSON.parse(text) as { contacts: { photos?: TestPhoto[] }[] };
  return doc.contacts[0]!.photos ?? [];
}

describe("withExternalPhotos — save", () => {
  it("files each image out as bytes and strips it from the document", async () => {
    const { store, files } = fakeStore();
    const { adapter, state } = fakeInner();
    const wrapped = withExternalPhotos(adapter, store);

    await wrapped.save(
      docWith([{ id: "p1", photo: JPEG, photoSource: OTHER_JPEG }]),
      undefined,
    );

    expect([...files.keys()].sort()).toEqual([ADA_PHOTO, ADA_SOURCE].sort());
    const saved = photosOf(state.text!)[0]!;
    expect(saved.photo).toBeUndefined();
    expect(saved.photoSource).toBeUndefined();
    expect(saved.photoPath).toBe(ADA_PHOTO);
    expect(saved.photoSourcePath).toBe(ADA_SOURCE);
  });

  it("prunes a file no contact references any more", async () => {
    const { store, files, removed } = fakeStore();
    files.set("photos/gone-abcd-1.jpg", new Uint8Array([1]));
    const { adapter } = fakeInner();
    const wrapped = withExternalPhotos(adapter, store);

    await wrapped.save(docWith([{ id: "p1", photo: JPEG }]), undefined);

    expect(removed).toEqual(["photos/gone-abcd-1.jpg"]);
    expect(files.has(ADA_PHOTO)).toBe(true);
  });
});

describe("withExternalPhotos — a failed upload never costs a photo", () => {
  it("keeps the already-filed copy when the re-upload is throttled", async () => {
    // The regression: a photo filed on an earlier session, re-uploaded on this
    // one (the write cache is per-session), whose upload fails. The path used to
    // drop out of the desired set, and the prune then deleted the good file.
    const { store, files, removed } = fakeStore({
      write: new Set([ADA_PHOTO]),
    });
    files.set(ADA_PHOTO, new Uint8Array([1, 2, 3]));
    const { adapter, state } = fakeInner();
    const wrapped = withExternalPhotos(adapter, store);

    await wrapped.save(
      docWith([{ id: "p1", photo: JPEG, photoPath: ADA_PHOTO }]),
      undefined,
    );

    expect(removed).toEqual([]);
    expect(files.has(ADA_PHOTO)).toBe(true);
    // Externalise-or-embed: the image rides along inline so it still syncs.
    expect(photosOf(state.text!)[0]!.photo).toBe(JPEG);
  });

  it("stands the whole prune down, sparing unrelated files too", async () => {
    const { store, files, removed } = fakeStore({
      write: new Set([ADA_PHOTO]),
    });
    files.set("photos/someone-else-abcd-1.jpg", new Uint8Array([9]));
    const { adapter } = fakeInner();
    const wrapped = withExternalPhotos(adapter, store);

    await wrapped.save(docWith([{ id: "p1", photo: JPEG }]), undefined);

    expect(removed).toEqual([]);
  });

  it("never prunes when the outgoing document can't be parsed", async () => {
    const { store, files, removed } = fakeStore();
    files.set(ADA_PHOTO, new Uint8Array([1]));
    files.set(ADA_SOURCE, new Uint8Array([2]));
    const { adapter } = fakeInner();
    const wrapped = withExternalPhotos(adapter, store);

    await wrapped.save("not json at all", undefined);

    expect(removed).toEqual([]);
    expect(files.size).toBe(2);
  });

  it("resumes pruning once the uploads succeed again", async () => {
    const failing = new Set([ADA_PHOTO]);
    const { store, files, removed } = fakeStore({ write: failing });
    files.set("photos/orphan-abcd-1.jpg", new Uint8Array([9]));
    const { adapter } = fakeInner();
    const wrapped = withExternalPhotos(adapter, store);
    const doc = docWith([{ id: "p1", photo: JPEG }]);

    await wrapped.save(doc, undefined);
    expect(removed).toEqual([]);

    failing.clear();
    await wrapped.save(doc, undefined);
    expect(removed).toEqual(["photos/orphan-abcd-1.jpg"]);
  });
});

describe("withExternalPhotos — load", () => {
  it("reads each filed image back onto its contact", async () => {
    const { store } = fakeStore();
    const { adapter } = fakeInner();
    const wrapped = withExternalPhotos(adapter, store);
    await wrapped.save(
      docWith([{ id: "p1", photo: JPEG, photoSource: OTHER_JPEG }]),
      undefined,
    );

    const snap = await wrapped.load();
    const loaded = photosOf(snap!.text)[0]!;
    expect(loaded.photo).toBe(JPEG);
    expect(loaded.photoSource).toBe(OTHER_JPEG);
  });

  it("keeps the reference when a read fails, so the photo can be re-fetched", async () => {
    const { store } = fakeStore({ read: new Set([ADA_PHOTO]) });
    const { adapter } = fakeInner(
      docWith([
        { id: "p1", photoPath: ADA_PHOTO, photoSourcePath: ADA_SOURCE },
      ]),
    );
    const wrapped = withExternalPhotos(adapter, store);

    const snap = await wrapped.load();
    const loaded = photosOf(snap!.text)[0]!;
    expect(loaded.photoPath).toBe(ADA_PHOTO);
    expect(loaded.photo).toBeUndefined();
  });

  it("reads a large gallery a few files at a time", async () => {
    const { store, files, peakInFlight } = fakeStore();
    const photos = Array.from({ length: 30 }, (_, i) => {
      const path = photoPathFor(ADA, i + 1);
      files.set(path, new Uint8Array([1]));
      return { id: `p${i + 1}`, photoPath: path };
    });
    const { adapter } = fakeInner(docWith(photos));
    const wrapped = withExternalPhotos(adapter, store);

    await wrapped.load();

    expect(peakInFlight()).toBeGreaterThan(1);
    expect(peakInFlight()).toBeLessThanOrEqual(DEFAULT_TRANSFER_CONCURRENCY);
  });

  it("re-indexes a filed photo the document lost track of", async () => {
    const { store, files } = fakeStore();
    files.set(ADA_PHOTO, new Uint8Array([1]));
    const { adapter } = fakeInner(docWith([{ id: "p1" }]));
    let resaveAsked = false;
    const wrapped = withExternalPhotos(adapter, store, () => {
      resaveAsked = true;
    });

    const snap = await wrapped.load();

    expect(photosOf(snap!.text)[0]!.photoPath).toBe(ADA_PHOTO);
    expect(resaveAsked).toBe(true);
  });
});

// The tiered (cloud) shape: the render tier covers the faces on open, and the
// kept originals are left for `photoSource.ts` to fetch when something asks.
// See the module note on `atlas.ts`.
describe("withExternalPhotos — tiered", () => {
  it("does not read kept originals on open", async () => {
    const { store, files, reads } = fakeStore();
    files.set(ADA_PHOTO, new Uint8Array([1]));
    files.set(ADA_SOURCE, new Uint8Array([2]));
    const { adapter } = fakeInner(
      docWith([
        { id: "p1", photoPath: ADA_PHOTO, photoSourcePath: ADA_SOURCE },
      ]),
    );
    const wrapped = withExternalPhotos(adapter, store, undefined, {
      tiered: true,
    });

    const snap = await wrapped.load();

    expect(reads).toContain(ADA_PHOTO);
    expect(reads).not.toContain(ADA_SOURCE);
    // The reference survives — that is what the on-demand fetch reads later.
    expect(photosOf(snap!.text)[0]!.photoSourcePath).toBe(ADA_SOURCE);
    expect(photosOf(snap!.text)[0]!.photoSource).toBeUndefined();
  });

  it("still reads them on an untiered backend", async () => {
    // A picked local folder has no rate limit and browsability is its whole
    // point, so it keeps filing and reading every image eagerly.
    const { store, files, reads } = fakeStore();
    files.set(ADA_PHOTO, new Uint8Array([1]));
    files.set(ADA_SOURCE, new Uint8Array([2]));
    const { adapter } = fakeInner(
      docWith([
        { id: "p1", photoPath: ADA_PHOTO, photoSourcePath: ADA_SOURCE },
      ]),
    );
    const wrapped = withExternalPhotos(adapter, store);

    await wrapped.load();

    expect(reads).toContain(ADA_SOURCE);
  });

  it("skips the archival read for a crop the atlas already covered", async () => {
    const { store, files, reads } = fakeStore();
    files.set(ADA_PHOTO, new Uint8Array([1]));
    const { adapter } = fakeInner(
      docWith([{ id: "p1", photoPath: ADA_PHOTO, photoTile: "data:tile" }]),
    );
    const wrapped = withExternalPhotos(adapter, store, undefined, {
      tiered: true,
    });

    await wrapped.load();

    expect(reads).not.toContain(ADA_PHOTO);
  });

  it("never prunes an atlas pack as an orphaned photo", async () => {
    // Packs live in the same `photos/` tree the archival prune sweeps, and no
    // contact references one by path — so without the exclusion every save
    // would delete the whole render tier.
    const { store, files, removed } = fakeStore();
    const pack = atlasPackPath(1, "abcdef0123456789");
    files.set(pack, new Uint8Array([1]));
    files.set("photos/orphan-of-nobody-9z9z-1.jpg", new Uint8Array([2]));
    const { adapter } = fakeInner();
    const wrapped = withExternalPhotos(adapter, store, undefined, {
      tiered: true,
    });

    await wrapped.save(docWith([]), undefined);

    expect(removed).toEqual(["photos/orphan-of-nobody-9z9z-1.jpg"]);
    expect(files.has(pack)).toBe(true);
  });
});
