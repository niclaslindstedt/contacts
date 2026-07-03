// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { dragCarriesImage, firstImageFile } from "../src/app/photoDrop.ts";

// The routing rules that keep the contact photo drop and the address-book
// importer from fighting over the same drag: an image is a photo, anything else
// (a .vcf/CSV/JSON) is left to the importer.

describe("dragCarriesImage", () => {
  it("claims a drag with an image file item", () => {
    expect(dragCarriesImage([{ kind: "file", type: "image/png" }])).toBe(true);
    expect(dragCarriesImage([{ kind: "file", type: "image/jpeg" }])).toBe(true);
  });

  it("ignores non-image file drags so the importer can claim them", () => {
    // A .vcf with a known type, and one whose type the browser left blank.
    expect(dragCarriesImage([{ kind: "file", type: "text/vcard" }])).toBe(
      false,
    );
    expect(dragCarriesImage([{ kind: "file", type: "" }])).toBe(false);
  });

  it("ignores dragged text/elements (no file item)", () => {
    expect(dragCarriesImage([{ kind: "string", type: "text/plain" }])).toBe(
      false,
    );
    expect(dragCarriesImage([])).toBe(false);
  });

  it("claims a mixed drag as long as an image is present", () => {
    expect(
      dragCarriesImage([
        { kind: "file", type: "text/vcard" },
        { kind: "file", type: "image/webp" },
      ]),
    ).toBe(true);
  });
});

describe("firstImageFile", () => {
  it("returns the first image among dropped files", () => {
    const vcf = { type: "text/vcard" };
    const png = { type: "image/png" };
    const jpg = { type: "image/jpeg" };
    expect(firstImageFile([vcf, png, jpg])).toBe(png);
  });

  it("returns null when no file is an image", () => {
    expect(firstImageFile([{ type: "text/vcard" }, { type: "" }])).toBeNull();
    expect(firstImageFile([])).toBeNull();
  });
});
