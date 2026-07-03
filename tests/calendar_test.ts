// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { birthdayIcs, dateEventIcs } from "../src/app/calendar.ts";

// A fixed "now" so the DTSTAMP is deterministic — 3 July 2026, 09:30:00 UTC.
const NOW = new Date(Date.UTC(2026, 6, 3, 9, 30, 0));

function ics(iso: string, summary = "Ada Lovelace's birthday"): string {
  return (
    birthdayIcs({ iso, summary, uid: "birthday-c1@contacts.app", now: NOW }) ??
    ""
  );
}

describe("birthdayIcs", () => {
  it("wraps a single all-day event in a VCALENDAR", () => {
    const out = ics("1990-07-20");
    expect(out.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(out).toContain("BEGIN:VEVENT");
    expect(out).toContain("END:VEVENT");
    // CRLF line endings, as RFC 5545 requires.
    expect(out.split("\n").every((l) => l === "" || l.endsWith("\r"))).toBe(
      true,
    );
  });

  it("recurs every year", () => {
    expect(ics("1990-07-20")).toContain("RRULE:FREQ=YEARLY");
  });

  it("anchors the all-day event on the birth date, DTEND the next day", () => {
    const out = ics("1990-07-20");
    expect(out).toContain("DTSTART;VALUE=DATE:19900720");
    expect(out).toContain("DTEND;VALUE=DATE:19900721");
  });

  it("rolls DTEND across a month boundary", () => {
    const out = ics("1988-01-31");
    expect(out).toContain("DTSTART;VALUE=DATE:19880131");
    expect(out).toContain("DTEND;VALUE=DATE:19880201");
  });

  it("keeps a Feb-29 birthday on the 29th so it recurs in leap years", () => {
    const out = ics("2000-02-29");
    expect(out).toContain("DTSTART;VALUE=DATE:20000229");
    expect(out).toContain("DTEND;VALUE=DATE:20000301");
  });

  it("stamps the moment the file was made in UTC", () => {
    expect(ics("1990-07-20")).toContain("DTSTAMP:20260703T093000Z");
  });

  it("carries a stable UID for update-not-duplicate re-imports", () => {
    expect(ics("1990-07-20")).toContain("UID:birthday-c1@contacts.app");
  });

  it("uses the supplied summary and escapes RFC 5545 specials", () => {
    const out = ics("1990-07-20", "Ada, Countess; birthday");
    expect(out).toContain("SUMMARY:Ada\\, Countess\\; birthday");
  });

  it("is null for a date that isn't real", () => {
    expect(
      birthdayIcs({
        iso: "2001-02-30",
        summary: "x",
        uid: "u",
        now: NOW,
      }),
    ).toBeNull();
    expect(
      birthdayIcs({ iso: "not-a-date", summary: "x", uid: "u", now: NOW }),
    ).toBeNull();
  });
});

function dateIcs(value: string, summary = "Anniversary Sarah Connor"): string {
  return (
    dateEventIcs({ value, summary, uid: "date-d1@contacts.app", now: NOW }) ??
    ""
  );
}

describe("dateEventIcs", () => {
  it("anchors a full date on its own year and recurs yearly", () => {
    const out = dateIcs("2010-06-15");
    expect(out).toContain("DTSTART;VALUE=DATE:20100615");
    expect(out).toContain("DTEND;VALUE=DATE:20100616");
    expect(out).toContain("RRULE:FREQ=YEARLY");
    expect(out).toContain("SUMMARY:Anniversary Sarah Connor");
  });

  it("anchors a yearless date already passed this year on next year", () => {
    // 15 June is before 3 July (NOW), so the first reminder is next year.
    const out = dateIcs("06-15");
    expect(out).toContain("DTSTART;VALUE=DATE:20270615");
    expect(out).toContain("DTEND;VALUE=DATE:20270616");
  });

  it("anchors a yearless date still ahead this year on this year", () => {
    const out = dateIcs("08-15");
    expect(out).toContain("DTSTART;VALUE=DATE:20260815");
    expect(out).toContain("DTEND;VALUE=DATE:20260816");
  });

  it("carries a stable UID and escapes the woven summary", () => {
    const out = dateIcs("2010-06-15", "Anniversary; Sarah, Connor");
    expect(out).toContain("UID:date-d1@contacts.app");
    expect(out).toContain("SUMMARY:Anniversary\\; Sarah\\, Connor");
  });

  it("is null for a date that isn't real", () => {
    expect(
      dateEventIcs({ value: "13-40", summary: "x", uid: "u", now: NOW }),
    ).toBeNull();
  });
});
