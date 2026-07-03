// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { GLYPH_PATHS } from "@niclaslindstedt/oss-framework/glyphs";

import {
  CONTACT_GLYPH_NAMES,
  CONTACT_GLYPH_PATHS,
  contactGlyphPath,
} from "../src/app/contactGlyphs.ts";

describe("contact glyph catalogue", () => {
  it("offers a glyph the render map can draw for every picker entry", () => {
    for (const name of CONTACT_GLYPH_NAMES) {
      expect(CONTACT_GLYPH_PATHS[name], name).toBeTruthy();
    }
  });

  it("has no duplicate picker entries", () => {
    expect(new Set(CONTACT_GLYPH_NAMES).size).toBe(CONTACT_GLYPH_NAMES.length);
  });

  it("keeps rendering any framework glyph a card may already carry", () => {
    // Legacy cards may hold a glyph the picker no longer offers; the render map
    // is a superset of the framework catalogue so those still draw.
    for (const name of Object.keys(GLYPH_PATHS)) {
      expect(contactGlyphPath(name), name).toBe(GLYPH_PATHS[name]);
    }
  });

  it("resolves a nameless glyph to undefined so the caller can fall back", () => {
    expect(contactGlyphPath(null)).toBeUndefined();
    expect(contactGlyphPath(undefined)).toBeUndefined();
    expect(contactGlyphPath("")).toBeUndefined();
    expect(contactGlyphPath("not-a-glyph")).toBeUndefined();
  });
});
