// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The important-date maths. Beyond the birthday, a contact can carry any number
// of notable dates (see `types.ts`) — a name day, an anniversary — and each may
// or may not know its year: an anniversary is "15 June 2010", but a name day is
// just "15 June". So these dates are stored as a full ISO `YYYY-MM-DD` when the
// year is known, or a bare `MM-DD` when it isn't.
//
// This module is the pure seam over that flexible shape: parse it, tell how many
// days remain until the next occurrence, and (when the year is known) how many
// years have passed. The read view's chip hands the date to the device calendar
// via `calendar.ts`. Everything here takes the reference "now" as an argument,
// so the whole surface is deterministic and unit-testable in node (see
// `tests/importantDates_test.ts`).

import { formatDate, MONTHS_EN, type DateFormat } from "./format.ts";

/** A parsed important date: month and day always, year only when it was given.
 *  A yearless date (`MM-DD`) leaves `y` null. */
export type FlexDate = { y: number | null; m: number; d: number };

// Validate a month/day pair against a leap year (2000) so 29 February is
// accepted for a yearless date — it's a real calendar day, just not every year.
function validMonthDay(m: number, d: number): boolean {
  const probe = new Date(2000, m - 1, d);
  return probe.getMonth() === m - 1 && probe.getDate() === d;
}

/** Parse a stored important-date string into its parts, or null when it isn't a
 *  real date. Accepts a full ISO `YYYY-MM-DD` (year known) or a bare `MM-DD`
 *  (day and month only). Rejects impossible days like `02-30`. */
export function parseFlexDate(value: string): FlexDate | null {
  const s = value.trim();
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (full) {
    const y = Number(full[1]);
    const m = Number(full[2]);
    const d = Number(full[3]);
    const probe = new Date(y, m - 1, d);
    if (
      probe.getFullYear() === y &&
      probe.getMonth() === m - 1 &&
      probe.getDate() === d
    ) {
      return { y, m, d };
    }
    return null;
  }
  const short = /^(\d{2})-(\d{2})$/.exec(s);
  if (short) {
    const m = Number(short[1]);
    const d = Number(short[2]);
    if (validMonthDay(m, d)) return { y: null, m, d };
  }
  return null;
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
 *  a dated one. A 29 February date rolls onto 1 March in common years. */
export function daysUntilDate(value: string, now: Date): number | null {
  const p = parseFlexDate(value);
  if (!p) return null;
  const MS_PER_DAY = 86_400_000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), p.m - 1, p.d);
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, p.m - 1, p.d);
  }
  return Math.round((next.getTime() - today.getTime()) / MS_PER_DAY);
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
 *  readout; a yearless date has none. */
export function yearsSince(value: string, now: Date): number | null {
  const p = parseFlexDate(value);
  if (!p || p.y === null) return null;
  const monthNow = now.getMonth() + 1;
  const hadItThisYear =
    monthNow > p.m || (monthNow === p.m && now.getDate() >= p.d);
  const years = now.getFullYear() - p.y - (hadItThisYear ? 0 : 1);
  return years < 0 ? null : years;
}
