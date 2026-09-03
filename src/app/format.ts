// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// How a stored ISO date renders — this app's own date-format setting, which is
// a presentation choice the framework's `Intl` wrappers do not make for us.
//
// The rest of what this module used to hold is the framework's now. Pulling a
// free-typed phone number apart into calling code / national digits /
// extension (`parsePhone`, `toStoredPhone`, `phoneDialString`, `extSuffix`)
// and the digit-grouping primitives (`digitsOnly`, `groupDigits`,
// `groupPairsLeadingTriple`) all come from
// `@niclaslindstedt/oss-framework/format`. *How* a country groups its national
// digits, and how a postal code is laid out, stays where it always was — a
// per-country convention in `countries/`, written with those primitives.
//
// Everything here is a pure function over strings — no DOM, no settings hook —
// so the whole surface is unit-testable in node (see `tests/format_test.ts`).
// The stored value is never mutated by these renderers: a date is kept as the
// ISO string and only *displayed* in the chosen shape, so changing a setting
// reformats every card without touching the document.

// --- Date --------------------------------------------------------------------

/** How a stored ISO date (`YYYY-MM-DD`) is shown. */
export type DateFormat = "iso" | "us" | "eu" | "long";

export const DATE_FORMATS: readonly DateFormat[] = [
  "iso",
  "us",
  "eu",
  "long",
] as const;

/** English month names, index 0 = January. Shared with the important-date
 *  formatter so its "long" form matches the birthday's. */
export const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Render a stored `YYYY-MM-DD` date in the chosen style. A value that isn't a
 *  well-formed ISO date is returned untouched — the birthday field is free to
 *  hold a partial draft while the user is still typing. */
export function formatDate(iso: string, format: DateFormat): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const year = m[1]!;
  const month = m[2]!;
  const day = m[3]!;
  const monthName = MONTHS_EN[Number(month) - 1];
  switch (format) {
    case "us":
      return `${month}/${day}/${year}`;
    case "eu":
      return `${day}/${month}/${year}`;
    case "long":
      // Drop a leading zero on the day for the prose form ("3 July 2026").
      return `${Number(day)} ${monthName} ${year}`;
    case "iso":
    default:
      return `${year}-${month}-${day}`;
  }
}
