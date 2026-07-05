// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  digitsOnly,
  formatDate,
  groupDigits,
  groupPairsLeadingTriple,
  parsePhone,
  phoneDialString,
  toStoredPhone,
} from "../src/app/format.ts";

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

describe("parsePhone", () => {
  it("splits an international number into country code and national digits", () => {
    const p = parsePhone("+46 8 123 456 78");
    expect(p.countryCode).toBe("46");
    expect(p.national).toBe("812345678");
    expect(p.valid).toBe(true);
  });

  it("treats the 00 access prefix as international", () => {
    const p = parsePhone("0046 8 12 34 56");
    expect(p.countryCode).toBe("46");
    expect(p.national).toBe("8123456");
  });

  it("keeps a bare local number entirely in national", () => {
    const p = parsePhone("(555) 123-4567");
    expect(p.countryCode).toBeNull();
    expect(p.national).toBe("5551234567");
  });

  it("peels a trailing extension off the number", () => {
    const p = parsePhone("+1 202 555 0100 ext. 42");
    expect(p.countryCode).toBe("1");
    expect(p.national).toBe("2025550100");
    expect(p.ext).toBe("42");
  });

  it("reports an empty / digitless input as invalid", () => {
    expect(parsePhone("").valid).toBe(false);
    expect(parsePhone("  no digits  ").valid).toBe(false);
  });
});

describe("toStoredPhone", () => {
  it("strips separators and peels the calling code off an international number", () => {
    expect(toStoredPhone("+46 (0)70-123 45 67")).toEqual({
      value: "0701234567",
      countryCode: "46",
    });
    expect(toStoredPhone("0046 8 12 34 56")).toEqual({
      value: "8123456",
      countryCode: "46",
    });
  });

  it("keeps a bare local number as pure national digits with no code", () => {
    expect(toStoredPhone("(555) 123-4567")).toEqual({ value: "5551234567" });
    expect(toStoredPhone("08-123 45 67")).toEqual({ value: "081234567" });
  });

  it("drops a trailing extension, leaving only the national digits", () => {
    expect(toStoredPhone("+1 202 555 0100 ext. 42")).toEqual({
      value: "2025550100",
      countryCode: "1",
    });
  });

  it("yields an empty value for a digitless input", () => {
    expect(toStoredPhone("n/a")).toEqual({ value: "" });
  });
});

describe("phoneDialString", () => {
  it("re-attaches the calling code to the national digits", () => {
    expect(phoneDialString({ value: "701234567", countryCode: "46" })).toBe(
      "+46701234567",
    );
  });

  it("returns bare national digits when there is no code", () => {
    expect(phoneDialString({ value: "0812345678" })).toBe("0812345678");
  });

  it("is empty when there are no digits", () => {
    expect(phoneDialString({ value: "" })).toBe("");
  });
});

describe("digit grouping helpers", () => {
  it("strips non-digits", () => {
    expect(digitsOnly("+46 (0)76-818 13 37")).toBe("460768181337");
    expect(digitsOnly("N/A")).toBe("");
  });

  it("groups into fixed-size chunks", () => {
    expect(groupDigits("2025550100")).toBe("202 555 010 0");
    expect(groupDigits("12345", 2, "-")).toBe("12-34-5");
  });

  it("groups pairs with a leading triple when the count is odd", () => {
    expect(groupPairsLeadingTriple("8181337")).toBe("818 13 37"); // 7 → 3 2 2
    expect(groupPairsLeadingTriple("123456")).toBe("12 34 56"); // 6 → 2 2 2
    expect(groupPairsLeadingTriple("12345")).toBe("123 45"); // 5 → 3 2
    expect(groupPairsLeadingTriple("")).toBe("");
  });
});
