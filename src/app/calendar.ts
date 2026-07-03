// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Birthday → calendar. The read view's countdown chip hands a birthday off to
// the device calendar, so the reminder lives where the user already looks. The
// interchange format is iCalendar (RFC 5545) — a `.ics` file that iOS Calendar,
// Google Calendar, and Outlook all import: one all-day event on the birth date
// that recurs every year (`RRULE:FREQ=YEARLY`).
//
// A pure renderer over the domain types — no DOM here — so the whole surface is
// unit-testable in node (see `tests/calendar_test.ts`). The download glue
// (Blob + anchor click) lives in `download.ts`; the caller supplies the
// already-translated event title so this module stays free of the i18n runtime.

import { parseBirthday } from "./birthday.ts";

/** Escape a text value per RFC 5545 §3.3.11: backslash, semicolon, comma,
 *  newline. */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets with a leading space on continuations, as
 *  RFC 5545 §3.1 prescribes. Folding on UTF-16 length is a close-enough proxy —
 *  importers accept shorter lines. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    parts.push(` ${line.slice(i, i + 74)}`);
  }
  return parts.join("\r\n");
}

/** Two-digit zero-pad for the date/time fields. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYYMMDD` for an all-day DATE value. */
function icsDate(y: number, m: number, d: number): string {
  return `${y}${pad(m)}${pad(d)}`;
}

/** `YYYYMMDDTHHMMSSZ` UTC stamp for DTSTAMP — the moment the file was made. */
function icsStamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}` +
    `${pad(now.getUTCDate())}T${pad(now.getUTCHours())}` +
    `${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

/** One birthday as an importable `.ics` calendar: a single all-day event on the
 *  birth date that recurs every year. Returns null when the birthday string
 *  isn't a real date. `summary` is the (already translated) event title; `uid`
 *  makes the event stable across re-imports so a calendar updates the same
 *  entry rather than piling up duplicates. */
export function birthdayIcs(opts: {
  iso: string;
  summary: string;
  uid: string;
  now: Date;
}): string | null {
  const p = parseBirthday(opts.iso);
  if (!p) return null;
  const start = icsDate(p.y, p.m, p.d);
  // An all-day DTEND is exclusive, so the day after the birthday closes a
  // single-day event.
  const endDate = new Date(p.y, p.m - 1, p.d + 1);
  const end = icsDate(
    endDate.getFullYear(),
    endDate.getMonth() + 1,
    endDate.getDate(),
  );
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//contacts//birthday//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${icsEscape(opts.uid)}`,
    `DTSTAMP:${icsStamp(opts.now)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    "RRULE:FREQ=YEARLY",
    `SUMMARY:${icsEscape(opts.summary)}`,
    // A birthday shouldn't mark you busy.
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
