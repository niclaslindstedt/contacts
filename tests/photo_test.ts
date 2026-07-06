// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { dataUrlToBytes } from "@niclaslindstedt/oss-framework/files";

import {
  contactTag,
  fromViewTransform,
  parsePhotoPath,
  photoPathFor,
  photoSourcePathFor,
  toViewTransform,
} from "../src/app/photo.ts";
import {
  hasInlinePhotos,
  withExternalPhotos,
  type PhotoStore,
} from "../src/app/photoStore.ts";

// The photo layer's node-testable surface: the deterministic file path, the
// stored-transform mapping, and the strip / re-hydrate / prune / re-file
// behaviour of `withExternalPhotos` (driven with in-memory fakes — the crop
// geometry, the canvas bake, and the real cloud stores are the framework
// viewer's). The data-URL ⇄ bytes codec the externaliser moves across is the
// framework's (`files`), used here only as a test helper.

const ADA = { id: "c1", firstName: "Ada", lastName: "Lovelace" };

describe("contactTag", () => {
  it("is a stable four-character tag derived from the id", () => {
    const tag = contactTag("c1");
    expect(tag).toMatch(/^[0-9a-z]{4}$/);
    expect(contactTag("c1")).toBe(tag); // deterministic
  });

  it("differs between different ids (disambiguates same-named contacts)", () => {
    expect(contactTag("a")).not.toBe(contactTag("b"));
  });
});

describe("photoPathFor", () => {
  it("builds a deterministic photos/<name>-<tag>-<index>.jpg path", () => {
    const path = photoPathFor(ADA, 1);
    expect(path).toBe(`photos/ada-lovelace-${contactTag("c1")}-1.jpg`);
    // Deterministic — same input, same path.
    expect(photoPathFor(ADA, 1)).toBe(path);
  });

  it("numbers photos by their 1-based gallery position", () => {
    expect(photoPathFor(ADA, 1)).toBe(
      `photos/ada-lovelace-${contactTag("c1")}-1.jpg`,
    );
    expect(photoPathFor(ADA, 2)).toBe(
      `photos/ada-lovelace-${contactTag("c1")}-2.jpg`,
    );
    expect(photoPathFor(ADA, 1)).not.toBe(photoPathFor(ADA, 2));
  });

  it("disambiguates same-named contacts by their tag", () => {
    const a = photoPathFor({ id: "a", firstName: "Sam", lastName: "Lee" }, 1);
    const b = photoPathFor({ id: "b", firstName: "Sam", lastName: "Lee" }, 1);
    expect(a).not.toBe(b);
  });

  it("falls back to the company, then a generic stem", () => {
    expect(photoPathFor({ id: "x", company: "Acme Inc" }, 1)).toBe(
      `photos/acme-inc-${contactTag("x")}-1.jpg`,
    );
    expect(photoPathFor({ id: "y" }, 1)).toBe(
      `photos/contact-${contactTag("y")}-1.jpg`,
    );
  });

  it("files the source beside the display crop", () => {
    expect(photoSourcePathFor(ADA, 1)).toBe(
      `photos/ada-lovelace-${contactTag("c1")}-1-source.jpg`,
    );
  });
});

describe("parsePhotoPath", () => {
  it("round-trips a display and a source path built by photoPathFor", () => {
    expect(parsePhotoPath(photoPathFor(ADA, 1), ["c1"])).toEqual({
      contactId: "c1",
      index: 1,
      source: false,
    });
    expect(parsePhotoPath(photoSourcePathFor(ADA, 2), ["c1"])).toEqual({
      contactId: "c1",
      index: 2,
      source: true,
    });
  });

  it("accepts the current scheme only when the tag maps to a real card", () => {
    const path = photoPathFor(ADA, 1);
    expect(parsePhotoPath(path, ["c1", "c2"])).toEqual({
      contactId: "c1",
      index: 1,
      source: false,
    });
    // The same filename, but c1 isn't in the set — its tag matches no card.
    expect(parsePhotoPath(path, ["c2", "c3"])).toBeNull();
  });

  it("still parses a legacy <contactId>-<photoId> path (for re-filing)", () => {
    const contactId = "contact-11111111-2222-3333-4444-555555555555";
    const photoId = "photo-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const path = `photos/jean-luc-de-la-fontaine-${contactId}-${photoId}.jpg`;
    expect(parsePhotoPath(path, [contactId])).toEqual({
      contactId,
      photoId,
      source: false,
    });
    // The source variant too.
    expect(
      parsePhotoPath(`photos/x-${contactId}-${photoId}-source.jpg`, [
        contactId,
      ]),
    ).toEqual({ contactId, photoId, source: true });
  });

  it("returns null when the path names no known contact", () => {
    expect(parsePhotoPath(photoPathFor(ADA, 1), ["other"])).toBeNull();
    // Not under photos/, or not a .jpg.
    expect(parsePhotoPath("attachments/ada-c1-a1.pdf", ["c1"])).toBeNull();
    // Legacy shape with nothing after the contact id to serve as a photo id.
    expect(parsePhotoPath("photos/ada-c1-.jpg", ["c1"])).toBeNull();
  });
});

describe("stored transform ⇄ viewer transform", () => {
  it("maps the stored x/y pan onto the framework's tx/ty and back", () => {
    const stored = { scale: 2.5, x: 0.25, y: -0.1 };
    expect(toViewTransform(stored)).toEqual({ scale: 2.5, tx: 0.25, ty: -0.1 });
    expect(fromViewTransform(toViewTransform(stored))).toEqual(stored);
  });
});

// -- withExternalPhotos --------------------------------------------------------

function memPhotoStore(): PhotoStore & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    list: async () => [...files.keys()],
    read: async (p) => files.get(p) ?? null,
    write: async (p, bytes) => void files.set(p, bytes),
    remove: async (p) => void files.delete(p),
  };
}

/** The bytes a `data:` URL decodes to, as a plain array for easy comparison. */
function bytesOf(dataUrl: string): number[] {
  return Array.from(dataUrlToBytes(dataUrl)!.bytes);
}

function fakeInner() {
  let saved: string | null = null;
  return {
    id: "dropbox" as const,
    label: "Dropbox",
    capabilities: new Set<never>(),
    load: async () => (saved == null ? null : { text: saved, revision: "r" }),
    save: async (text: string) => {
      saved = text;
      return { text, revision: "r2" };
    },
    lastSaved: () => saved,
  };
}

const doc = (contacts: unknown[]) =>
  JSON.stringify({ version: 2, folders: [], contacts, activeContactId: "" });

// "ABC" and "DEF" as JPEG-ish data URIs — the actual bytes don't matter, only
// that they round-trip through the byte file store.
const DISPLAY = "data:image/jpeg;base64,QUJD"; // "ABC"
const SOURCE = "data:image/jpeg;base64,REVG"; // "DEF"

// The deterministic paths Ada's first gallery photo files out to.
const DISPLAY_PATH = photoPathFor(ADA, 1);
const SOURCE_PATH = photoSourcePathFor(ADA, 1);

describe("withExternalPhotos", () => {
  // A contact carrying one gallery photo with the given fields.
  const withPhoto = (fields: Record<string, unknown>) => ({
    ...ADA,
    photos: [{ id: "ph1", ...fields }],
  });

  it("externalises both images as binary files and strips them from the doc", async () => {
    const store = memPhotoStore();
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    await adapter.save(
      doc([withPhoto({ photo: DISPLAY, photoSource: SOURCE })]),
    );

    // Both files landed at their deterministic paths as raw bytes (not text).
    const display = store.files.get(DISPLAY_PATH);
    const source = store.files.get(SOURCE_PATH);
    expect(display).toBeInstanceOf(Uint8Array);
    expect(Array.from(display!)).toEqual(bytesOf(DISPLAY));
    expect(Array.from(source!)).toEqual(bytesOf(SOURCE));

    // The synced doc kept the paths but dropped every image byte.
    const p = JSON.parse(inner.lastSaved()!).contacts[0].photos[0];
    expect(p.photoPath).toBe(DISPLAY_PATH);
    expect(p.photoSourcePath).toBe(SOURCE_PATH);
    expect(p.photo).toBeUndefined();
    expect(p.photoSource).toBeUndefined();
  });

  it("numbers each photo in a multi-photo gallery by position", async () => {
    const store = memPhotoStore();
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    await adapter.save(
      doc([
        {
          ...ADA,
          photos: [
            { id: "ph1", photo: DISPLAY },
            { id: "ph2", photo: SOURCE },
          ],
        },
      ]),
    );

    // Each gallery entry files out to its 1-based-index path — no collision.
    expect(store.files.has(photoPathFor(ADA, 1))).toBe(true);
    expect(store.files.has(photoPathFor(ADA, 2))).toBe(true);
    const photos = JSON.parse(inner.lastSaved()!).contacts[0].photos;
    expect(photos[0].photoPath).toBe(photoPathFor(ADA, 1));
    expect(photos[1].photoPath).toBe(photoPathFor(ADA, 2));
    expect(photos.every((p: { photo?: string }) => p.photo === undefined)).toBe(
      true,
    );
  });

  it("re-hydrates both images from their files on load", async () => {
    const store = memPhotoStore();
    store.files.set(DISPLAY_PATH, dataUrlToBytes(DISPLAY)!.bytes);
    store.files.set(SOURCE_PATH, dataUrlToBytes(SOURCE)!.bytes);
    const inner = fakeInner();
    await inner.save(
      doc([
        withPhoto({ photoPath: DISPLAY_PATH, photoSourcePath: SOURCE_PATH }),
      ]),
    );

    const adapter = withExternalPhotos(inner, store);
    const snap = await adapter.load();
    const p = JSON.parse(snap!.text).contacts[0].photos[0];
    expect(bytesOf(p.photo)).toEqual(bytesOf(DISPLAY));
    expect(bytesOf(p.photoSource)).toEqual(bytesOf(SOURCE));
  });

  it("files out an imported inline photo on the next save", async () => {
    // An imported vCard photo lands in a gallery entry's `photo` with no
    // source — it should still be broken out into a file rather than ride
    // inline in the document.
    const store = memPhotoStore();
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    await adapter.save(doc([withPhoto({ photo: DISPLAY })]));

    expect(store.files.has(DISPLAY_PATH)).toBe(true);
    const p = JSON.parse(inner.lastSaved()!).contacts[0].photos[0];
    expect(p.photo).toBeUndefined();
    expect(p.photoPath).toBe(DISPLAY_PATH);
  });

  it("prunes orphaned photo files once a contact loses its photo", async () => {
    const store = memPhotoStore();
    store.files.set(DISPLAY_PATH, dataUrlToBytes(DISPLAY)!.bytes);
    store.files.set(SOURCE_PATH, dataUrlToBytes(SOURCE)!.bytes);
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    // Save a doc where the contact no longer carries any photo.
    await adapter.save(doc([{ ...ADA, photos: [] }]));
    expect(store.files.has(DISPLAY_PATH)).toBe(false);
    expect(store.files.has(SOURCE_PATH)).toBe(false);
  });

  it("keeps a photo inline when the file write fails (externalise-or-embed)", async () => {
    const store = memPhotoStore();
    store.write = async () => {
      throw new Error("network down");
    };
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    await adapter.save(
      doc([withPhoto({ photo: DISPLAY, photoSource: SOURCE })]),
    );

    const p = JSON.parse(inner.lastSaved()!).contacts[0].photos[0];
    // Not filed, so the images stay in the synced doc — never lost.
    expect(p.photo).toBe(DISPLAY);
    expect(p.photoSource).toBe(SOURCE);
    expect(p.photoPath).toBeUndefined();
    expect(p.photoSourcePath).toBeUndefined();
  });

  it("signals a load that still holds inline photos (one-time sweep)", async () => {
    const store = memPhotoStore();
    const inner = fakeInner();
    // A pre-file-layout cloud copy: photos still embedded inline.
    await inner.save(doc([withPhoto({ photo: DISPLAY, photoSource: SOURCE })]));

    let signalled = 0;
    const adapter = withExternalPhotos(inner, store, () => (signalled += 1));
    await adapter.load();
    expect(signalled).toBe(1);
  });

  it("does not signal a load that is already fully filed out", async () => {
    const store = memPhotoStore();
    store.files.set(DISPLAY_PATH, dataUrlToBytes(DISPLAY)!.bytes);
    const inner = fakeInner();
    // A filed-out cloud copy carries only paths, no inline bytes.
    await inner.save(doc([withPhoto({ photoPath: DISPLAY_PATH })]));

    let signalled = 0;
    const adapter = withExternalPhotos(inner, store, () => (signalled += 1));
    await adapter.load();
    expect(signalled).toBe(0);
  });

  it("re-files a photo filed under the legacy naming and prunes the old file", async () => {
    // A cloud copy from an older build: files and stored paths use the
    // <contactId>-<photoId> scheme. On load it should signal a re-file, and the
    // next save writes the current <tag>-<index> file and prunes the legacy one.
    const store = memPhotoStore();
    const legacyDisplay = "photos/ada-lovelace-c1-ph1.jpg";
    const legacySource = "photos/ada-lovelace-c1-ph1-source.jpg";
    store.files.set(legacyDisplay, dataUrlToBytes(DISPLAY)!.bytes);
    store.files.set(legacySource, dataUrlToBytes(SOURCE)!.bytes);
    const inner = fakeInner();
    await inner.save(
      doc([
        withPhoto({
          photoPath: legacyDisplay,
          photoSourcePath: legacySource,
        }),
      ]),
    );

    let signalled = 0;
    const adapter = withExternalPhotos(inner, store, () => (signalled += 1));
    // Load: legacy paths are stale vs the current scheme → a re-file is asked for.
    const snap = await adapter.load();
    expect(signalled).toBe(1);
    // The loaded copy has the bytes back inline (rehydrated from the old files).
    const loaded = JSON.parse(snap!.text).contacts[0].photos[0];
    expect(bytesOf(loaded.photo)).toEqual(bytesOf(DISPLAY));

    // Saving that rehydrated copy re-files to the current paths and prunes old.
    await adapter.save(snap!.text);
    expect(store.files.has(DISPLAY_PATH)).toBe(true);
    expect(store.files.has(SOURCE_PATH)).toBe(true);
    expect(store.files.has(legacyDisplay)).toBe(false);
    expect(store.files.has(legacySource)).toBe(false);
    const saved = JSON.parse(inner.lastSaved()!).contacts[0].photos[0];
    expect(saved.photoPath).toBe(DISPLAY_PATH);
    expect(saved.photoSourcePath).toBe(SOURCE_PATH);
  });

  it("re-indexes a lost reference back onto its existing gallery entry", async () => {
    // The files are on the drive and the gallery entry still exists, but it lost
    // its path references (e.g. the local copy shed them). Reconcile re-attaches
    // by the file's 1-based index.
    const store = memPhotoStore();
    store.files.set(DISPLAY_PATH, dataUrlToBytes(DISPLAY)!.bytes);
    store.files.set(SOURCE_PATH, dataUrlToBytes(SOURCE)!.bytes);
    const inner = fakeInner();
    // Entry present, but with no path fields at all.
    await inner.save(doc([withPhoto({})]));

    let signalled = 0;
    const adapter = withExternalPhotos(inner, store, () => (signalled += 1));
    const snap = await adapter.load();
    const photos = JSON.parse(snap!.text).contacts[0].photos;
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe("ph1");
    expect(photos[0].photoPath).toBe(DISPLAY_PATH);
    expect(photos[0].photoSourcePath).toBe(SOURCE_PATH);
    // The reclaimed images are rehydrated back inline for offline rendering.
    expect(bytesOf(photos[0].photo)).toEqual(bytesOf(DISPLAY));
    expect(bytesOf(photos[0].photoSource)).toEqual(bytesOf(SOURCE));
    // And the caller is told to file the recovered references out.
    expect(signalled).toBe(1);
  });

  it("adopts a legacy hand-dropped photo whose name carries a real contact id", async () => {
    // A user dropped an image into the drive under the old naming — an existing
    // contact id and a fresh photo id — with no matching gallery entry yet.
    const store = memPhotoStore();
    store.files.set(
      "photos/anything-readable-c1-dropped.jpg",
      dataUrlToBytes(DISPLAY)!.bytes,
    );
    const inner = fakeInner();
    await inner.save(doc([{ ...ADA, photos: [] }]));

    const adapter = withExternalPhotos(inner, store);
    const snap = await adapter.load();
    const photos = JSON.parse(snap!.text).contacts[0].photos;
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe("dropped");
    expect(photos[0].photoPath).toBe("photos/anything-readable-c1-dropped.jpg");
    expect(bytesOf(photos[0].photo)).toEqual(bytesOf(DISPLAY));
  });

  it("re-indexed files survive the next save's prune", async () => {
    // A lost reference is re-indexed on load, then the same document is saved
    // back — the reclaimed file must be kept, not pruned as an orphan.
    const store = memPhotoStore();
    store.files.set(DISPLAY_PATH, dataUrlToBytes(DISPLAY)!.bytes);
    const inner = fakeInner();
    await inner.save(doc([withPhoto({})]));

    const adapter = withExternalPhotos(inner, store);
    const snap = await adapter.load();
    await adapter.save(snap!.text);

    expect(store.files.has(DISPLAY_PATH)).toBe(true);
    const p = JSON.parse(inner.lastSaved()!).contacts[0].photos[0];
    expect(p.photoPath).toBe(DISPLAY_PATH);
    expect(p.photo).toBeUndefined();
  });

  it("leaves a photo file whose contact is gone untouched (and does not signal)", async () => {
    const store = memPhotoStore();
    store.files.set("photos/ghost-cX-ph1.jpg", dataUrlToBytes(DISPLAY)!.bytes);
    const inner = fakeInner();
    await inner.save(doc([{ ...ADA, photos: [] }]));

    let signalled = 0;
    const adapter = withExternalPhotos(inner, store, () => (signalled += 1));
    const snap = await adapter.load();
    // No contact named cX — nothing adopted, nothing signalled. (The file is
    // left in place; it is only pruned once a save's document is authoritative.)
    expect(JSON.parse(snap!.text).contacts[0].photos).toHaveLength(0);
    expect(signalled).toBe(0);
  });
});

describe("hasInlinePhotos", () => {
  it("is true when a gallery photo still embeds image bytes inline", () => {
    expect(
      hasInlinePhotos(
        doc([{ id: "c1", photos: [{ id: "ph1", photo: DISPLAY }] }]),
      ),
    ).toBe(true);
    expect(
      hasInlinePhotos(
        doc([{ id: "c1", photos: [{ id: "ph1", photoSource: SOURCE }] }]),
      ),
    ).toBe(true);
  });

  it("is false for a filed-out copy, non-data values, or junk", () => {
    // Only paths — the filed-out layout.
    expect(
      hasInlinePhotos(
        doc([
          {
            id: "c1",
            photos: [{ id: "ph1", photoPath: "photos/a.jpg", photo: "" }],
          },
        ]),
      ),
    ).toBe(false);
    // A non-data-URI string (e.g. a stray label) doesn't count as image bytes.
    expect(
      hasInlinePhotos(doc([{ id: "c1", photos: [{ id: "ph1", photo: "p" }] }])),
    ).toBe(false);
    expect(hasInlinePhotos(doc([{ id: "c1", photos: [] }]))).toBe(false);
    expect(hasInlinePhotos(doc([]))).toBe(false);
    expect(hasInlinePhotos("not json")).toBe(false);
  });
});
