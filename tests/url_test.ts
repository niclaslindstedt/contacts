// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { displayUrl, normalizeUrl } from "../src/app/url.ts";

describe("normalizeUrl", () => {
  it("prefixes a bare host with https://", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("  example.com/path ")).toBe(
      "https://example.com/path",
    );
  });

  it("leaves a value that already carries a scheme untouched", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
  });

  it("returns empty for a blank value", () => {
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
    expect(normalizeUrl(undefined)).toBe("");
  });
});

describe("displayUrl", () => {
  it("strips the scheme and a trailing slash", () => {
    expect(displayUrl("https://example.com/")).toBe("example.com");
    expect(displayUrl("http://example.com/path")).toBe("example.com/path");
    expect(displayUrl("example.com")).toBe("example.com");
  });

  it("returns empty for a blank value", () => {
    expect(displayUrl("")).toBe("");
    expect(displayUrl(undefined)).toBe("");
  });
});
