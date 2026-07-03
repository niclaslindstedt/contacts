// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatPhone,
  formatPhoneValue,
  formatZip,
  parsePhone,
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

describe("formatPhone", () => {
  const parsed = parsePhone("+46812345678");

  it("echoes the raw input for the raw style", () => {
    expect(formatPhone(parsed, "raw")).toBe("+46812345678");
  });

  it("groups digits and keeps the country code for international", () => {
    expect(formatPhone(parsed, "international")).toBe("+46 812 345 678");
  });

  it("drops the country code for the national style", () => {
    expect(formatPhone(parsed, "national")).toBe("812 345 678");
  });

  it("adds the leading 0 trunk prefix for the Swedish style", () => {
    // A country-code number is dialled nationally with a single leading 0.
    expect(formatPhone(parsed, "swedish")).toBe("081 234 567 8");
    // A bare local number keeps its single leading 0, never doubling it.
    expect(formatPhoneValue("076811256", "swedish")).toBe("076 811 256");
    expect(formatPhoneValue("+46768112567", "swedish")).toBe("076 811 256 7");
  });

  it("compacts to a separator-free E.164 string", () => {
    expect(formatPhone(parsed, "e164")).toBe("+46812345678");
  });

  it("carries an extension through each non-compact style", () => {
    const ext = parsePhone("+1 202 555 0100 x42");
    expect(formatPhone(ext, "international")).toBe("+1 202 555 010 0 ext. 42");
    expect(formatPhone(ext, "e164")).toBe("+12025550100x42");
  });

  it("falls back to raw when nothing parses", () => {
    expect(formatPhoneValue("n/a", "international")).toBe("n/a");
  });

  it("formats a bare local number without inventing a country code", () => {
    expect(formatPhoneValue("5551234567", "international")).toBe(
      "555 123 456 7",
    );
    expect(formatPhoneValue("5551234567", "e164")).toBe("5551234567");
  });
});

describe("formatZip", () => {
  it("leaves the raw style untouched", () => {
    expect(formatZip("12345-6789", "raw")).toBe("12345-6789");
  });

  it("clamps to a 5-digit US ZIP", () => {
    expect(formatZip("12345-6789", "us5")).toBe("12345");
    expect(formatZip("12345", "us5")).toBe("12345");
  });

  it("renders ZIP+4 when there are enough digits", () => {
    expect(formatZip("123456789", "us9")).toBe("12345-6789");
    expect(formatZip("12345", "us9")).toBe("12345");
  });

  it("renders the five-digit Swedish 'xxx xx' form", () => {
    expect(formatZip("12345", "se")).toBe("123 45");
    expect(formatZip("123 45", "se")).toBe("123 45");
    // Extra digits are clamped to five; a short draft stays untouched.
    expect(formatZip("123456789", "se")).toBe("123 45");
    expect(formatZip("12", "se")).toBe("12");
  });

  it("splits the last two digits for the spaced style", () => {
    expect(formatZip("12345", "spaced")).toBe("123 45");
    expect(formatZip("12", "spaced")).toBe("12");
  });

  it("returns a digitless value as-is", () => {
    expect(formatZip("N/A", "us5")).toBe("N/A");
  });
});
