// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The important-date maths. Beyond the birthday, a contact can carry any number
// of notable dates (see `types.ts`) — a name day, an anniversary — and each may
// or may not know its year: an anniversary is "15 June 2010", but a name day is
// just "15 June". So these dates are stored as a full ISO `YYYY-MM-DD` when the
// year is known, or a bare `MM-DD` when it isn't.
//
// This module is the pure seam over that flexible shape: parse it, tell how many
// days remain until the next occurrence, and (when the year is known) how many
// years have passed. The date maths itself is the framework calendar module's;
// what stays app-side are thin shims that keep this module's names and the
// `FlexDate` shape the rest of the app (and the tests) speak. The read view's
// chip hands the date to the device calendar via the `.ics` shims at the
// bottom, thin compositions over the framework's RFC 5545 builders. Everything
// here takes the reference "now" as an argument, so the whole surface is
// deterministic and unit-testable in node (see `tests/importantDates_test.ts`).

import {
  buildIcsCalendar,
  daysUntilNextOccurrence,
  nextOccurrence,
  parseDateParts,
  yearsSince as calendarYearsSince,
} from "@niclaslindstedt/oss-framework/calendar";

import { formatDate, MONTHS_EN, type DateFormat } from "./format.ts";

/** A parsed important date: month and day always, year only when it was given.
 *  A yearless date (`MM-DD`) leaves `y` null. */
export type FlexDate = { y: number | null; m: number; d: number };

/** Parse a stored important-date string into its parts, or null when it isn't a
 *  real date. Accepts a full ISO `YYYY-MM-DD` (year known) or a bare `MM-DD`
 *  (day and month only). Rejects impossible days like `02-30`. A shim over the
 *  framework's `parseDateParts`, renaming its fields to the app's terse
 *  `FlexDate` shape. */
export function parseFlexDate(value: string): FlexDate | null {
  const p = parseDateParts(value);
  if (!p) return null;
  return { y: p.year, m: p.month, d: p.day };
}

/** True when the stored value parses as a real important date. */
export function isValidFlexDate(value: string): boolean {
  return parseFlexDate(value) !== null;
}

/** Split a full ISO date into the `MM-DD` day-and-month form, or return a value
 *  that's already yearless unchanged. Used by the editor's year toggle. */
export function toMonthDay(value: string): string {
  const p = parseFlexDate(value);
  if (!p) return value;
  return `${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Days until the next occurrence of the date: 0 on the day itself, 1 the day
 *  before, counting forward to the same month/day next year. null when the
 *  string isn't a real date. Year-agnostic — a yearless date works the same as
 *  a dated one. A 29 February date rolls onto 1 March in common years. The
 *  framework's `daysUntilNextOccurrence`, under this module's name. */
export function daysUntilDate(value: string, now: Date): number | null {
  return daysUntilNextOccurrence(value, now);
}

/** Render a stored important date for display. A full date follows the chosen
 *  {@link DateFormat} (matching the birthday's rendering); a yearless one shows
 *  the same style with the year dropped ("15 June", "06-15", …). */
export function formatImportantDate(value: string, format: DateFormat): string {
  const p = parseFlexDate(value);
  if (!p) return value;
  if (p.y !== null) return formatDate(value, format);
  const mm = String(p.m).padStart(2, "0");
  const dd = String(p.d).padStart(2, "0");
  switch (format) {
    case "us":
      return `${mm}/${dd}`;
    case "eu":
      return `${dd}/${mm}`;
    case "long":
      return `${p.d} ${MONTHS_EN[p.m - 1]}`;
    case "iso":
    default:
      return `${mm}-${dd}`;
  }
}

/** Whole years since the date on `now`, or null when the year is unknown, the
 *  date is invalid, or it lies in the future. An anniversary's "N years"
 *  readout; a yearless date has none. The framework's `yearsSince`,
 *  re-exported under the same name. */
export function yearsSince(value: string, now: Date): number | null {
  return calendarYearsSince(value, now);
}

// --- handing a date to the device calendar -----------------------------------
//
// The read view's chips download a one-event `.ics` file (RFC 5545) that iOS
// Calendar, Google Calendar, and Outlook all import: a single all-day event
// that recurs every year, marked free (`TRANSP:TRANSPARENT`) so a reminder
// never blocks the user's availability. The framework owns the envelope and
// the escaping / folding; these shims only decide the anchor date and the
// PRODID, and the caller supplies the already-translated event title so the
// module stays free of the i18n runtime.

/** One birthday as an importable `.ics` calendar: a single all-day event on
 *  the birth date that recurs every year. Returns null when the birthday
 *  string isn't a real full `YYYY-MM-DD` date — a birthday always knows its
 *  year. `uid` makes the event stable across re-imports so a calendar updates
 *  the same entry rather than piling up duplicates. */
export function birthdayIcs(opts: {
  iso: string;
  summary: string;
  uid: string;
  now: Date;
}): string | null {
  const p = parseDateParts(opts.iso);
  if (!p || p.year === null) return null;
  return buildIcsCalendar({
    prodId: "-//contacts//birthday//EN",
    events: [
      {
        uid: opts.uid,
        summary: opts.summary,
        date: { year: p.year, month: p.month, day: p.day },
        repeat: "yearly",
      },
    ],
    now: opts.now,
  });
}

/** One important date as an importable `.ics` calendar, the same yearly
 *  all-day shape as {@link birthdayIcs} but for a flexible date: a full ISO
 *  `YYYY-MM-DD`, or a bare `MM-DD` with no year. A yearless date is anchored
 *  on its next occurrence from `now`, so the reminder starts in the future and
 *  then recurs every year on the same month/day; a dated one anchors on its
 *  own year. Returns null when the value isn't a real date. `summary` is the
 *  (already translated and name-woven) title — e.g. "Anniversary Sarah
 *  Connor". */
export function dateEventIcs(opts: {
  value: string;
  summary: string;
  uid: string;
  now: Date;
}): string | null {
  const p = parseDateParts(opts.value);
  if (!p) return null;
  const date =
    p.year !== null
      ? { year: p.year, month: p.month, day: p.day }
      : nextOccurrence(opts.value, opts.now);
  if (!date) return null;
  return buildIcsCalendar({
    prodId: "-//contacts//important-date//EN",
    events: [{ uid: opts.uid, summary: opts.summary, date, repeat: "yearly" }],
    now: opts.now,
  });
}
