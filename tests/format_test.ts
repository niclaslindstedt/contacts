// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

// The phone parsing and digit-grouping this file used to cover is the
// framework's now (`@niclaslindstedt/oss-framework/format`), and tested
// there. What is left here is this app's own date-format setting.
import { formatDate } from "../src/app/format.ts";

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
