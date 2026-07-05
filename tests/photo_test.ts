// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  bytesToDataUrl,
  clampTransform,
  dataUrlToBytes,
  drawRect,
  parsePhotoPath,
  photoPathFor,
  photoSourcePathFor,
} from "../src/app/photo.ts";
import {
  hasInlinePhotos,
  withExternalPhotos,
  type PhotoStore,
} from "../src/app/photoStore.ts";

// The photo layer's node-testable surface: the deterministic file path, the
// data-URL ⇄ bytes seam the externaliser moves across, the crop geometry, and
// the strip / re-hydrate / prune behaviour of `withExternalPhotos` (driven with
// in-memory fakes — the canvas bake and the real cloud stores stay UI-only).

describe("photoPathFor", () => {
  it("builds a deterministic photos/<name>-<id>-<photoId>.jpg path", () => {
    const path = photoPathFor(
      { id: "c1", firstName: "Ada", lastName: "Lovelace" },
      "ph1",
    );
    expect(path).toBe("photos/ada-lovelace-c1-ph1.jpg");
    // Deterministic — same input, same path.
    expect(
      photoPathFor({ id: "c1", firstName: "Ada", lastName: "Lovelace" }, "ph1"),
    ).toBe(path);
  });

  it("disambiguates same-named contacts by id, and photos by photo id", () => {
    const a = photoPathFor({ id: "a", firstName: "Sam", lastName: "Lee" }, "p");
    const b = photoPathFor({ id: "b", firstName: "Sam", lastName: "Lee" }, "p");
    expect(a).not.toBe(b);
    // Two photos on the same card get distinct paths.
    const c = { id: "a", firstName: "Sam", lastName: "Lee" };
    expect(photoPathFor(c, "p1")).not.toBe(photoPathFor(c, "p2"));
  });

  it("falls back to the company, then a generic stem", () => {
    expect(photoPathFor({ id: "x", company: "Acme Inc" }, "ph")).toBe(
      "photos/acme-inc-x-ph.jpg",
    );
    expect(photoPathFor({ id: "y" }, "ph")).toBe("photos/contact-y-ph.jpg");
  });

  it("files the source beside the display crop", () => {
    const c = { id: "c1", firstName: "Ada", lastName: "Lovelace" };
    expect(photoPathFor(c, "ph1")).toBe("photos/ada-lovelace-c1-ph1.jpg");
    expect(photoSourcePathFor(c, "ph1")).toBe(
      "photos/ada-lovelace-c1-ph1-source.jpg",
    );
  });
});

describe("parsePhotoPath", () => {
  it("round-trips a display and a source path built by photoPathFor", () => {
    const c = { id: "c1", firstName: "Ada", lastName: "Lovelace" };
    const display = photoPathFor(c, "ph1");
    const source = photoSourcePathFor(c, "ph1");
    expect(parsePhotoPath(display, ["c1"])).toEqual({
      contactId: "c1",
      photoId: "ph1",
      source: false,
    });
    expect(parsePhotoPath(source, ["c1"])).toEqual({
      contactId: "c1",
      photoId: "ph1",
      source: true,
    });
  });

  it("anchors on the known contact id even when the slug carries hyphens", () => {
    // A uuid-shaped contact id and a name-slug full of hyphens: the parse must
    // still split at the id, not guess where the slug ends.
    const contactId = "contact-11111111-2222-3333-4444-555555555555";
    const photoId = "photo-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const path = `photos/jean-luc-de-la-fontaine-${contactId}-${photoId}.jpg`;
    expect(parsePhotoPath(path, [contactId])).toEqual({
      contactId,
      photoId,
      source: false,
    });
  });

  it("picks the id that matches a real contact from the given set", () => {
    const path = "photos/sam-lee-c2-ph9.jpg";
    expect(parsePhotoPath(path, ["c1", "c2", "c3"])).toEqual({
      contactId: "c2",
      photoId: "ph9",
      source: false,
    });
  });

  it("returns null when no known contact id is embedded", () => {
    expect(
      parsePhotoPath("photos/ada-lovelace-c1-ph1.jpg", ["other"]),
    ).toBeNull();
    // Not under photos/, or not a .jpg.
    expect(parsePhotoPath("attachments/ada-c1-a1.pdf", ["c1"])).toBeNull();
    // Nothing after the contact id to serve as a photo id.
    expect(parsePhotoPath("photos/ada-c1-.jpg", ["c1"])).toBeNull();
  });
});

describe("data URL <-> bytes", () => {
  it("round-trips bytes through a base64 data URL", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 128, 255]);
    const url = bytesToDataUrl("image/jpeg", bytes);
    expect(url.startsWith("data:image/jpeg;base64,")).toBe(true);
    const back = dataUrlToBytes(url);
    expect(back?.mime).toBe("image/jpeg");
    expect(Array.from(back!.bytes)).toEqual(Array.from(bytes));
  });

  it("returns null for a non-base64 / non-data string", () => {
    expect(dataUrlToBytes("https://example.com/a.png")).toBeNull();
    expect(dataUrlToBytes(undefined)).toBeNull();
    expect(dataUrlToBytes("data:image/png,notbase64")).toBeNull();
  });
});

describe("crop geometry", () => {
  it("cover-fits a landscape image centred at the default framing", () => {
    // 200x100 into a 100 viewport: covers by height, so width overflows.
    const r = drawRect(200, 100, 100, { scale: 1, x: 0, y: 0 });
    expect(r.h).toBe(100);
    expect(r.w).toBe(200);
    expect(r.y).toBe(0);
    expect(r.x).toBe(-50); // centred: (100-200)/2
  });

  it("clamps the pan so the image can't uncover the circle", () => {
    // Landscape: horizontal pan allowed, vertical pinned; scale floored to 1.
    const t = clampTransform(200, 100, { scale: 0.2, x: 5, y: 5 });
    expect(t.scale).toBe(1);
    expect(t.y).toBe(0);
    expect(t.x).toBeCloseTo(0.5); // (w-1)/2 with w=2 in unit terms
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

describe("withExternalPhotos", () => {
  // A contact carrying one gallery photo with the given fields.
  const withPhoto = (fields: Record<string, unknown>) => ({
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
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
    const display = store.files.get("photos/ada-lovelace-c1-ph1.jpg");
    const source = store.files.get("photos/ada-lovelace-c1-ph1-source.jpg");
    expect(display).toBeInstanceOf(Uint8Array);
    expect(Array.from(display!)).toEqual(bytesOf(DISPLAY));
    expect(Array.from(source!)).toEqual(bytesOf(SOURCE));

    // The synced doc kept the paths but dropped every image byte.
    const p = JSON.parse(inner.lastSaved()!).contacts[0].photos[0];
    expect(p.photoPath).toBe("photos/ada-lovelace-c1-ph1.jpg");
    expect(p.photoSourcePath).toBe("photos/ada-lovelace-c1-ph1-source.jpg");
    expect(p.photo).toBeUndefined();
    expect(p.photoSource).toBeUndefined();
  });

  it("externalises every photo in a multi-photo gallery", async () => {
    const store = memPhotoStore();
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    await adapter.save(
      doc([
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          photos: [
            { id: "ph1", photo: DISPLAY },
            { id: "ph2", photo: SOURCE },
          ],
        },
      ]),
    );

    // Each gallery entry files out to its own path — no collision.
    expect(store.files.has("photos/ada-lovelace-c1-ph1.jpg")).toBe(true);
    expect(store.files.has("photos/ada-lovelace-c1-ph2.jpg")).toBe(true);
    const photos = JSON.parse(inner.lastSaved()!).contacts[0].photos;
    expect(photos[0].photoPath).toBe("photos/ada-lovelace-c1-ph1.jpg");
    expect(photos[1].photoPath).toBe("photos/ada-lovelace-c1-ph2.jpg");
    expect(photos.every((p: { photo?: string }) => p.photo === undefined)).toBe(
      true,
    );
  });

  it("re-hydrates both images from their files on load", async () => {
    const store = memPhotoStore();
    store.files.set(
      "photos/ada-lovelace-c1-ph1.jpg",
      dataUrlToBytes(DISPLAY)!.bytes,
    );
    store.files.set(
      "photos/ada-lovelace-c1-ph1-source.jpg",
      dataUrlToBytes(SOURCE)!.bytes,
    );
    const inner = fakeInner();
    await inner.save(
      doc([
        withPhoto({
          photoPath: "photos/ada-lovelace-c1-ph1.jpg",
          photoSourcePath: "photos/ada-lovelace-c1-ph1-source.jpg",
        }),
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

    expect(store.files.has("photos/ada-lovelace-c1-ph1.jpg")).toBe(true);
    const p = JSON.parse(inner.lastSaved()!).contacts[0].photos[0];
    expect(p.photo).toBeUndefined();
    expect(p.photoPath).toBe("photos/ada-lovelace-c1-ph1.jpg");
  });

  it("prunes orphaned photo files once a contact loses its photo", async () => {
    const store = memPhotoStore();
    store.files.set(
      "photos/ada-lovelace-c1-ph1.jpg",
      dataUrlToBytes(DISPLAY)!.bytes,
    );
    store.files.set(
      "photos/ada-lovelace-c1-ph1-source.jpg",
      dataUrlToBytes(SOURCE)!.bytes,
    );
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    // Save a doc where the contact no longer carries any photo.
    await adapter.save(
      doc([{ id: "c1", firstName: "Ada", lastName: "Lovelace", photos: [] }]),
    );
    expect(store.files.has("photos/ada-lovelace-c1-ph1.jpg")).toBe(false);
    expect(store.files.has("photos/ada-lovelace-c1-ph1-source.jpg")).toBe(
      false,
    );
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
    store.files.set(
      "photos/ada-lovelace-c1-ph1.jpg",
      dataUrlToBytes(DISPLAY)!.bytes,
    );
    const inner = fakeInner();
    // A filed-out cloud copy carries only paths, no inline bytes.
    await inner.save(
      doc([withPhoto({ photoPath: "photos/ada-lovelace-c1-ph1.jpg" })]),
    );

    let signalled = 0;
    const adapter = withExternalPhotos(inner, store, () => (signalled += 1));
    await adapter.load();
    expect(signalled).toBe(0);
  });

  it("re-indexes a lost photo file back onto its contact on load", async () => {
    // The files are on the drive, but the document lost the gallery entry that
    // referenced them (an empty gallery). Reconcile should find and re-attach.
    const store = memPhotoStore();
    store.files.set(
      "photos/ada-lovelace-c1-ph1.jpg",
      dataUrlToBytes(DISPLAY)!.bytes,
    );
    store.files.set(
      "photos/ada-lovelace-c1-ph1-source.jpg",
      dataUrlToBytes(SOURCE)!.bytes,
    );
    const inner = fakeInner();
    await inner.save(
      doc([{ id: "c1", firstName: "Ada", lastName: "Lovelace", photos: [] }]),
    );

    let signalled = 0;
    const adapter = withExternalPhotos(inner, store, () => (signalled += 1));
    const snap = await adapter.load();
    const photos = JSON.parse(snap!.text).contacts[0].photos;
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe("ph1");
    expect(photos[0].photoPath).toBe("photos/ada-lovelace-c1-ph1.jpg");
    expect(photos[0].photoSourcePath).toBe(
      "photos/ada-lovelace-c1-ph1-source.jpg",
    );
    // The reclaimed images are rehydrated back inline for offline rendering.
    expect(bytesOf(photos[0].photo)).toEqual(bytesOf(DISPLAY));
    expect(bytesOf(photos[0].photoSource)).toEqual(bytesOf(SOURCE));
    // And the caller is told to file the recovered references out.
    expect(signalled).toBe(1);
  });

  it("adopts a hand-dropped photo whose name carries a real contact id", async () => {
    // A user dropped an image into the drive and named it with an existing
    // contact's id and a fresh photo id — no matching gallery entry exists yet.
    const store = memPhotoStore();
    store.files.set(
      "photos/anything-readable-c1-dropped.jpg",
      dataUrlToBytes(DISPLAY)!.bytes,
    );
    const inner = fakeInner();
    await inner.save(
      doc([{ id: "c1", firstName: "Ada", lastName: "Lovelace", photos: [] }]),
    );

    const adapter = withExternalPhotos(inner, store);
    const snap = await adapter.load();
    const photos = JSON.parse(snap!.text).contacts[0].photos;
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe("dropped");
    expect(photos[0].photoPath).toBe("photos/anything-readable-c1-dropped.jpg");
    expect(bytesOf(photos[0].photo)).toEqual(bytesOf(DISPLAY));
  });

  it("re-indexed files survive the next save's prune", async () => {
    // A lost file is re-indexed on load, then the same document is saved back —
    // the reclaimed file must be kept, not pruned as an orphan.
    const store = memPhotoStore();
    store.files.set(
      "photos/ada-lovelace-c1-ph1.jpg",
      dataUrlToBytes(DISPLAY)!.bytes,
    );
    const inner = fakeInner();
    await inner.save(
      doc([{ id: "c1", firstName: "Ada", lastName: "Lovelace", photos: [] }]),
    );

    const adapter = withExternalPhotos(inner, store);
    const snap = await adapter.load();
    await adapter.save(snap!.text);

    expect(store.files.has("photos/ada-lovelace-c1-ph1.jpg")).toBe(true);
    const p = JSON.parse(inner.lastSaved()!).contacts[0].photos[0];
    expect(p.photoPath).toBe("photos/ada-lovelace-c1-ph1.jpg");
    expect(p.photo).toBeUndefined();
  });

  it("leaves a photo file whose contact is gone untouched (and does not signal)", async () => {
    const store = memPhotoStore();
    store.files.set("photos/ghost-cX-ph1.jpg", dataUrlToBytes(DISPLAY)!.bytes);
    const inner = fakeInner();
    await inner.save(
      doc([{ id: "c1", firstName: "Ada", lastName: "Lovelace", photos: [] }]),
    );

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
