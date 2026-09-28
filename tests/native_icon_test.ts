// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// The App Store rejects an app icon whose file has an alpha channel, even when
// every pixel is solid, so `make icons` writes the phone app's icon as plain
// RGB. The icon is generated and committed; this holds the committed copy to it.

const ROOT = join(import.meta.dirname, "..");
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ihdr(path: string) {
  const bytes = readFileSync(join(ROOT, path));
  expect([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colourType: bytes[25],
  };
}

describe("the phone app's icon", () => {
  it("is a 1024-pixel square with no alpha channel", () => {
    const { width, height, colourType } = ihdr("native/assets/icon.png");
    expect([width, height]).toEqual([1024, 1024]);
    // 2 is truecolour (RGB); 6 would be RGBA, 4 grey with alpha.
    expect(colourType).toBe(2);
  });
});
