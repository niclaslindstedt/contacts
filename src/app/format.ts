// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The country-agnostic core of display formatting. This module holds only what
// is true regardless of country: how a stored ISO date renders, and how a
// free-typed phone number is pulled apart into calling code / national digits /
// extension. *How* those national digits are grouped, and how a postal code is
// laid out, is deliberately NOT here — that is a per-country convention and
// lives in `countries/` (each country implements the `CountryFormat`
// interface). Nothing in this file knows that Sweden groups in pairs or that
// the US wraps its area code in parentheses.
//
// Everything here is a pure function over strings — no DOM, no settings hook —
// so the whole surface is unit-testable in node (see `tests/format_test.ts`).
// The stored value is never mutated by these renderers: a phone is kept
// verbatim as the user typed it and only *displayed* in the chosen shape, so
// changing a setting reformats every card without touching the document.

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

// --- Phone parsing -----------------------------------------------------------

/** The structured shape `parsePhone` recovers from a free-typed number. This is
 *  the input every country's phone formatter receives — country code and
 *  national digits already separated, so a formatter only decides grouping. */
export type ParsedPhone = {
  /** Country calling code without the leading `+` ("46"), or null when the
   *  input carried no explicit international prefix. */
  countryCode: string | null;
  /** National significant digits — no country code, no separators. May keep a
   *  leading trunk 0 when the number was typed in local form (a country
   *  formatter normalises this as its convention dictates). */
  national: string;
  /** Trailing extension digits ("x123"), or null. */
  ext: string | null;
  /** The original input, trimmed. */
  raw: string;
  /** True once at least one national digit was recovered. */
  valid: boolean;
};

// A table of E.164 calling codes, longest first so the prefix match is greedy
// (so "1" never shadows "1..."). This is numbering-plan data, not a formatting
// choice — it only helps `parsePhone` peel an explicit international prefix off
// the front. A country not listed here still parses; its digits simply stay in
// `national`. Only consulted when the input opens with `+` or `00`.
const CALLING_CODES = [
  "971",
  "972",
  "358",
  "353",
  "354",
  "351",
  "352",
  "420",
  "386",
  "372",
  "46",
  "47",
  "45",
  "49",
  "44",
  "33",
  "39",
  "34",
  "31",
  "41",
  "43",
  "32",
  "61",
  "64",
  "65",
  "81",
  "82",
  "48",
  "30",
  "91",
  "86",
  "52",
  "55",
  "1",
  "7",
];

/** Pull a free-typed phone number apart into country code / national digits /
 *  extension. Non-destructive and forgiving: anything it can't classify falls
 *  through to `national`, and `valid` reports whether any digit was found. */
export function parsePhone(input: string): ParsedPhone {
  const raw = input.trim();

  // Peel a trailing extension ("x123", "ext. 5", "#5") off the end first.
  let body = raw;
  let ext: string | null = null;
  const extMatch = /(?:\s*(?:ext\.?|extension|x|#)\s*)(\d{1,6})\s*$/i.exec(
    body,
  );
  if (extMatch) {
    ext = extMatch[1]!;
    body = body.slice(0, extMatch.index);
  }

  const international = /^\s*(?:\+|00)/.test(body);
  const digits = body.replace(/\D/g, "");
  // "00" is the international access prefix, not part of the number.
  const significant =
    international && digits.startsWith("00") ? digits.slice(2) : digits;

  let countryCode: string | null = null;
  let national = significant;
  if (international) {
    const cc = CALLING_CODES.find((code) => significant.startsWith(code));
    if (cc && significant.length > cc.length) {
      countryCode = cc;
      national = significant.slice(cc.length);
    }
  }

  return { countryCode, national, ext, raw, valid: national.length > 0 };
}

// --- Shared grouping helpers -------------------------------------------------
// Small pure primitives the country formatters build their conventions from.
// They express *how digits clump*, not any one country's rule.

/** Strip everything but digits. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

// --- Structured storage ------------------------------------------------------
// A phone is stored *structured*: national digits (no separators, no country
// code) plus its E.164 calling code. These two pure helpers are the single
// conversion between a free-typed string and that stored shape — used by the
// edit form (on commit), the document migration (existing numbers), and the
// importers (foreign cards).

/** The stored shape a free-typed phone number folds down to: national digits
 *  only, plus the E.164 calling code when the input carried an explicit
 *  international prefix (`+…` / `00…`). Separators and any trailing extension
 *  are dropped — the value is left as bare national digits. `countryCode` is
 *  omitted (not `null`) when the number carried no code, so it can be spread
 *  straight onto a {@link Phone}. */
export function toStoredPhone(input: string): {
  value: string;
  countryCode?: string;
} {
  const parsed = parsePhone(input);
  return parsed.countryCode
    ? { value: parsed.national, countryCode: parsed.countryCode }
    : { value: parsed.national };
}

/** The full dialable string for a stored phone — `+<code><national>` when it
 *  carries a calling code, else the bare national digits. What a `tel:` link
 *  and the vCard / CSV export write. Empty when there are no national digits. */
export function phoneDialString(phone: {
  value: string;
  countryCode?: string | null;
}): string {
  const national = digitsOnly(phone.value);
  if (!national) return "";
  return phone.countryCode ? `+${phone.countryCode}${national}` : national;
}

/** Group a run of digits into fixed-size chunks joined by `sep` (spaces by
 *  default). The trailing chunk keeps whatever digits remain. */
export function groupDigits(digits: string, size = 3, sep = " "): string {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += size) {
    groups.push(digits.slice(i, i + size));
  }
  return groups.join(sep);
}

/** Group digits into pairs from the left, letting the *first* group be a triple
 *  when the count is odd — the "three together if possible, otherwise groups of
 *  two" rule several European conventions share (e.g. Sweden's subscriber
 *  part). `"8181337"` → `"818 13 37"`, `"123456"` → `"12 34 56"`. */
export function groupPairsLeadingTriple(digits: string, sep = " "): string {
  if (digits.length === 0) return "";
  const groups: string[] = [];
  let i = 0;
  if (digits.length % 2 === 1) {
    groups.push(digits.slice(0, 3));
    i = 3;
  }
  for (; i < digits.length; i += 2) groups.push(digits.slice(i, i + 2));
  return groups.join(sep);
}

/** Render a parsed extension as a human suffix (" ext. 42"), or "" when none. */
export function extSuffix(ext: string | null): string {
  return ext ? ` ext. ${ext}` : "";
}
