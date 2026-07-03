// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { ageOn, daysUntilBirthday } from "../src/app/birthday.ts";

// A fixed "now" so the maths is deterministic — noon on 3 July 2026.
const NOW = new Date(2026, 6, 3, 12, 0, 0);

describe("ageOn", () => {
  it("counts whole years, before the birthday this year", () => {
    // Birthday later in July → hasn't turned yet.
    expect(ageOn("1990-07-20", NOW)).toBe(35);
  });

  it("counts the extra year once the birthday has passed", () => {
    expect(ageOn("1990-06-20", NOW)).toBe(36);
  });

  it("counts the birthday itself as a completed year", () => {
    expect(ageOn("1990-07-03", NOW)).toBe(36);
  });

  it("is null for an invalid or future date", () => {
    expect(ageOn("not-a-date", NOW)).toBeNull();
    expect(ageOn("2001-02-30", NOW)).toBeNull();
    expect(ageOn("2030-01-01", NOW)).toBeNull();
  });
});

describe("daysUntilBirthday", () => {
  it("is 0 on the birthday itself", () => {
    expect(daysUntilBirthday("1990-07-03", NOW)).toBe(0);
  });

  it("is 1 the day before", () => {
    expect(daysUntilBirthday("1990-07-04", NOW)).toBe(1);
  });

  it("counts forward to next year once this year's date has passed", () => {
    // 2 July already gone → next is 2 July 2027, 364 days out.
    expect(daysUntilBirthday("1990-07-02", NOW)).toBe(364);
  });

  it("counts a birthday later this year", () => {
    expect(daysUntilBirthday("1990-07-20", NOW)).toBe(17);
  });

  it("is null for an unparseable date", () => {
    expect(daysUntilBirthday("13/02/1990", NOW)).toBeNull();
  });
});
