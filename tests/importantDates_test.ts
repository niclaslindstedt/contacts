// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  daysUntilDate,
  formatImportantDate,
  isValidFlexDate,
  parseFlexDate,
  toMonthDay,
  yearsSince,
} from "../src/app/importantDates.ts";

describe("parseFlexDate", () => {
  it("parses a full ISO date, year and all", () => {
    expect(parseFlexDate("2010-06-15")).toEqual({ y: 2010, m: 6, d: 15 });
  });

  it("parses a bare MM-DD as a yearless date", () => {
    expect(parseFlexDate("06-15")).toEqual({ y: null, m: 6, d: 15 });
  });

  it("accepts 29 February with no year (a real calendar day)", () => {
    expect(parseFlexDate("02-29")).toEqual({ y: null, m: 2, d: 29 });
  });

  it("rejects impossible days and junk", () => {
    expect(parseFlexDate("2001-02-30")).toBeNull();
    expect(parseFlexDate("13-01")).toBeNull();
    expect(parseFlexDate("06-31")).toBeNull();
    expect(parseFlexDate("not-a-date")).toBeNull();
    expect(parseFlexDate("")).toBeNull();
  });
});

describe("isValidFlexDate / toMonthDay", () => {
  it("reports validity", () => {
    expect(isValidFlexDate("2010-06-15")).toBe(true);
    expect(isValidFlexDate("06-15")).toBe(true);
    expect(isValidFlexDate("nope")).toBe(false);
  });

  it("drops the year to the MM-DD form", () => {
    expect(toMonthDay("2010-06-15")).toBe("06-15");
    expect(toMonthDay("06-15")).toBe("06-15");
    expect(toMonthDay("junk")).toBe("junk");
  });
});

describe("daysUntilDate", () => {
  const now = new Date(2026, 6, 3); // 3 July 2026, local

  it("is 0 on the day itself", () => {
    expect(daysUntilDate("07-03", now)).toBe(0);
    expect(daysUntilDate("1990-07-03", now)).toBe(0);
  });

  it("counts forward to the next occurrence, ignoring the year", () => {
    expect(daysUntilDate("07-04", now)).toBe(1);
    // A date earlier in the year rolls to next year.
    expect(daysUntilDate("07-02", now)).toBe(364);
  });

  it("is null for an invalid date", () => {
    expect(daysUntilDate("bad", now)).toBeNull();
  });
});

describe("yearsSince", () => {
  const now = new Date(2026, 6, 3);

  it("counts whole years for a dated occasion", () => {
    expect(yearsSince("2010-07-03", now)).toBe(16);
    // Not yet reached this year → one fewer.
    expect(yearsSince("2010-07-04", now)).toBe(15);
  });

  it("has no years for a yearless or future date", () => {
    expect(yearsSince("07-03", now)).toBeNull();
    expect(yearsSince("2030-01-01", now)).toBeNull();
  });
});

describe("formatImportantDate", () => {
  it("formats a full date in the chosen style", () => {
    expect(formatImportantDate("2010-06-15", "iso")).toBe("2010-06-15");
    expect(formatImportantDate("2010-06-15", "us")).toBe("06/15/2010");
    expect(formatImportantDate("2010-06-15", "long")).toBe("15 June 2010");
  });

  it("drops the year for a yearless date, keeping the style", () => {
    expect(formatImportantDate("06-15", "iso")).toBe("06-15");
    expect(formatImportantDate("06-15", "us")).toBe("06/15");
    expect(formatImportantDate("06-15", "eu")).toBe("15/06");
    expect(formatImportantDate("06-15", "long")).toBe("15 June");
  });
});
