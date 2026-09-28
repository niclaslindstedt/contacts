// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

// The phone parsing and digit-grouping this file used to cover is the
// framework's now (`@niclaslindstedt/oss-framework/format`), and tested
// there. What is left here is this app's own date-format setting.
import { dateFormatFromLocales, formatDate } from "../src/app/format.ts";

describe("formatDate", () => {
  it("renders each style from a stored ISO date", () => {
    expect(formatDate("2026-07-03", "iso")).toBe("2026-07-03");
    expect(formatDate("2026-07-03", "us")).toBe("07/03/2026");
    expect(formatDate("2026-07-03", "eu")).toBe("03/07/2026");
    expect(formatDate("2026-07-03", "long")).toBe("3 July 2026");
  });

  it("drops the day's leading zero only in the long form", () => {
    expect(formatDate("2026-01-05", "long")).toBe("5 January 2026");
    expect(formatDate("2026-01-05", "us")).toBe("01/05/2026");
  });

  it("returns a non-ISO value untouched (a half-typed draft)", () => {
    expect(formatDate("2026-07", "us")).toBe("2026-07");
    expect(formatDate("", "long")).toBe("");
  });
});

describe("dateFormatFromLocales", () => {
  it("reads the first tag with a region", () => {
    expect(dateFormatFromLocales(["en-US", "sv-SE"])).toBe("us");
    expect(dateFormatFromLocales(["sv-SE", "en-US"])).toBe("iso");
    expect(dateFormatFromLocales(["de-DE"])).toBe("eu");
    expect(dateFormatFromLocales(["da-DK"])).toBe("eu");
    expect(dateFormatFromLocales(["ja-JP"])).toBe("iso");
  });

  it("reads a bare language as its likeliest region, like the home country", () => {
    expect(dateFormatFromLocales(["sv"])).toBe("iso");
    expect(dateFormatFromLocales(["fi"])).toBe("eu");
  });

  it('does not read a bare "en" as American', () => {
    expect(dateFormatFromLocales(["en"])).toBe("iso");
    // It names no region, so the next tag decides.
    expect(dateFormatFromLocales(["en", "en-US"])).toBe("us");
    expect(dateFormatFromLocales(["en", "en-GB"])).toBe("eu");
  });

  it("falls back to ISO for a region it has no rule for, or no tag at all", () => {
    expect(dateFormatFromLocales(["zh-CN"])).toBe("iso");
    expect(dateFormatFromLocales(["not a tag"])).toBe("iso");
    expect(dateFormatFromLocales([])).toBe("iso");
  });
});
