// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  bytesToDataUrl,
  clampTransform,
  dataUrlToBytes,
  drawRect,
  photoPathFor,
} from "../src/app/photo.ts";
import { withExternalPhotos, type PhotoStore } from "../src/app/photoStore.ts";

// The photo layer's node-testable surface: the deterministic file path, the
// data-URL ⇄ bytes seam the externaliser moves across, the crop geometry, and
// the strip / re-hydrate / prune behaviour of `withExternalPhotos` (driven with
// in-memory fakes — the canvas bake and the real cloud stores stay UI-only).

describe("photoPathFor", () => {
  it("builds a deterministic photos/<name>-<id>.jpg path", () => {
    const path = photoPathFor({
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(path).toBe("photos/ada-lovelace-c1.jpg");
    // Deterministic — same input, same path.
    expect(
      photoPathFor({ id: "c1", firstName: "Ada", lastName: "Lovelace" }),
    ).toBe(path);
  });

  it("disambiguates same-named contacts by id", () => {
    const a = photoPathFor({ id: "a", firstName: "Sam", lastName: "Lee" });
    const b = photoPathFor({ id: "b", firstName: "Sam", lastName: "Lee" });
    expect(a).not.toBe(b);
  });

  it("falls back to the company, then a generic stem", () => {
    expect(photoPathFor({ id: "x", company: "Acme Inc" })).toBe(
      "photos/acme-inc-x.jpg",
    );
    expect(photoPathFor({ id: "y" })).toBe("photos/contact-y.jpg");
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

function memPhotoStore(): PhotoStore & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    list: async () => [...files.keys()],
    read: async (p) => files.get(p) ?? null,
    write: async (p, data) => void files.set(p, data),
    remove: async (p) => void files.delete(p),
  };
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

describe("withExternalPhotos", () => {
  it("externalises the source to a file and strips it from the saved doc", async () => {
    const store = memPhotoStore();
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    const source = "data:image/jpeg;base64,QUJD"; // "ABC"
    await adapter.save(
      doc([
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          photo: "p",
          photoSource: source,
        },
      ]),
    );

    // The file landed at the deterministic path.
    expect(store.files.get("photos/ada-lovelace-c1.jpg")).toBe(source);
    // The synced doc kept a photoPath but dropped the heavy source.
    const savedContact = JSON.parse(inner.lastSaved()!).contacts[0];
    expect(savedContact.photoPath).toBe("photos/ada-lovelace-c1.jpg");
    expect(savedContact.photoSource).toBeUndefined();
    expect(savedContact.photo).toBe("p");
  });

  it("re-hydrates the source from its file on load", async () => {
    const store = memPhotoStore();
    const source = "data:image/jpeg;base64,QUJD";
    store.files.set("photos/ada-lovelace-c1.jpg", source);
    const inner = fakeInner();
    await inner.save(
      doc([
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          photo: "p",
          photoPath: "photos/ada-lovelace-c1.jpg",
        },
      ]),
    );

    const adapter = withExternalPhotos(inner, store);
    const snap = await adapter.load();
    const c = JSON.parse(snap!.text).contacts[0];
    expect(c.photoSource).toBe(source);
  });

  it("prunes an orphaned photo file once its contact loses the photo", async () => {
    const store = memPhotoStore();
    store.files.set(
      "photos/ada-lovelace-c1.jpg",
      "data:image/jpeg;base64,QUJD",
    );
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    // Save a doc where the contact no longer carries a photo.
    await adapter.save(
      doc([{ id: "c1", firstName: "Ada", lastName: "Lovelace" }]),
    );
    expect(store.files.has("photos/ada-lovelace-c1.jpg")).toBe(false);
  });

  it("keeps the photo inline when the file write fails (externalise-or-embed)", async () => {
    const store = memPhotoStore();
    store.write = async () => {
      throw new Error("network down");
    };
    const inner = fakeInner();
    const adapter = withExternalPhotos(inner, store);

    const source = "data:image/jpeg;base64,QUJD";
    await adapter.save(
      doc([
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          photo: "p",
          photoSource: source,
        },
      ]),
    );

    const c = JSON.parse(inner.lastSaved()!).contacts[0];
    // Not filed, so the source stays in the synced doc — never lost.
    expect(c.photoSource).toBe(source);
    expect(c.photoPath).toBeUndefined();
  });
});
