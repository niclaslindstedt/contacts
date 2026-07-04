// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  activePhoto,
  activePhotoIndex,
  hasPhoto,
  photoCount,
  photoList,
  withActivePhoto,
  withPhotoAdded,
  withPhotoAdjusted,
  withPhotoRemoved,
} from "../src/app/contactPhotos.ts";
import type { Contact } from "../src/app/types.ts";

// The pure photo-gallery rules: which entry is the face, and how add / remove /
// select / adjust reshape the set. No DOM, no id source — the caller mints ids.

const photo = (id: string) => ({ id, photo: `data:${id}` });

function gallery(ids: string[], active?: string): Contact {
  return {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
    photos: ids.map(photo),
    ...(active ? { activePhotoId: active } : {}),
  };
}

describe("activePhoto / the face rule", () => {
  it("is undefined for an empty or absent gallery", () => {
    expect(activePhoto({})).toBeUndefined();
    expect(activePhoto({ photos: [] })).toBeUndefined();
    expect(hasPhoto({ photos: [] })).toBe(false);
  });

  it("falls back to the first photo when no pointer is set", () => {
    const c = gallery(["a", "b", "c"]);
    expect(activePhoto(c)?.id).toBe("a");
    expect(activePhotoIndex(c)).toBe(0);
    expect(hasPhoto(c)).toBe(true);
    expect(photoCount(c)).toBe(3);
  });

  it("honours the pointer when it names a real entry", () => {
    const c = gallery(["a", "b", "c"], "c");
    expect(activePhoto(c)?.id).toBe("c");
    expect(activePhotoIndex(c)).toBe(2);
  });

  it("falls back to the first photo when the pointer is stale", () => {
    const c = gallery(["a", "b"], "gone");
    expect(activePhoto(c)?.id).toBe("a");
    expect(activePhotoIndex(c)).toBe(0);
  });
});

describe("withPhotoAdded", () => {
  it("appends the photo and makes it the face", () => {
    const c = gallery(["a"], "a");
    const patch = withPhotoAdded(c, photo("b"));
    expect(patch.photos?.map((p) => p.id)).toEqual(["a", "b"]);
    expect(patch.activePhotoId).toBe("b");
  });

  it("seeds the gallery from empty", () => {
    const patch = withPhotoAdded({}, photo("a"));
    expect(patch.photos?.map((p) => p.id)).toEqual(["a"]);
    expect(patch.activePhotoId).toBe("a");
  });
});

describe("withActivePhoto", () => {
  it("selects an existing entry", () => {
    expect(withActivePhoto(gallery(["a", "b"]), "b").activePhotoId).toBe("b");
  });

  it("leaves the pointer untouched for an unknown id", () => {
    const c = gallery(["a", "b"], "a");
    expect(withActivePhoto(c, "zz").activePhotoId).toBe("a");
  });
});

describe("withPhotoRemoved", () => {
  it("drops a non-active photo and keeps the pointer", () => {
    const c = gallery(["a", "b", "c"], "a");
    const patch = withPhotoRemoved(c, "c");
    expect(patch.photos?.map((p) => p.id)).toEqual(["a", "b"]);
    expect(patch.activePhotoId).toBe("a");
  });

  it("moves the pointer to the previous neighbour when the face is removed", () => {
    const c = gallery(["a", "b", "c"], "b");
    const patch = withPhotoRemoved(c, "b");
    expect(patch.photos?.map((p) => p.id)).toEqual(["a", "c"]);
    expect(patch.activePhotoId).toBe("a");
  });

  it("moves the pointer to the new first when the first (active) is removed", () => {
    const c = gallery(["a", "b"], "a");
    expect(withPhotoRemoved(c, "a").activePhotoId).toBe("b");
  });

  it("clears the pointer when the last photo goes", () => {
    const c = gallery(["a"], "a");
    const patch = withPhotoRemoved(c, "a");
    expect(patch.photos).toEqual([]);
    expect(patch.activePhotoId).toBeNull();
  });
});

describe("withPhotoAdjusted", () => {
  it("replaces one entry's fields in place, keeping order and id", () => {
    const c = gallery(["a", "b"], "b");
    const patch = withPhotoAdjusted(c, "b", {
      photo: "data:new",
      photoPath: null,
    });
    const b = patch.photos?.find((p) => p.id === "b");
    expect(b).toMatchObject({ id: "b", photo: "data:new", photoPath: null });
    // Order and the untouched entry survive.
    expect(patch.photos?.map((p) => p.id)).toEqual(["a", "b"]);
    expect(photoList({ photos: patch.photos })[0]).toEqual(photo("a"));
  });
});
