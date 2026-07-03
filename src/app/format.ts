// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Display formatting for the value-shaped fields a contact carries — dates
// (the birthday), phone numbers, and postal codes. The Format settings tab
// (see `settings/tabs.tsx`) picks one style per field; these pure functions
// render a stored value into that style.
//
// Everything here is a pure function over strings — no DOM, no settings hook —
// so the whole surface is unit-testable in node (see `tests/format_test.ts`).
// The stored value is never mutated by these renderers: a phone is kept
// verbatim as the user typed it and only *displayed* in the chosen shape, so
// changing the setting reformats every card without touching the document.

// --- Date --------------------------------------------------------------------

/** How a stored ISO date (`YYYY-MM-DD`) is shown. */
export type DateFormat = "iso" | "us" | "eu" | "long";

export const DATE_FORMATS: readonly DateFormat[] = [
  "iso",
  "us",
  "eu",
  "long",
] as const;

const MONTHS_EN = [
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

// --- Phone -------------------------------------------------------------------

/** How a phone number is shown once parsed. */
export type PhoneFormat = "raw" | "international" | "national" | "e164";

export const PHONE_FORMATS: readonly PhoneFormat[] = [
  "raw",
  "international",
  "national",
  "e164",
] as const;

/** The structured shape `parsePhone` recovers from a free-typed number. */
export type ParsedPhone = {
  /** Country calling code without the leading `+` ("46"), or null when the
   *  input carried no explicit international prefix. */
  countryCode: string | null;
  /** National significant digits — no country code, no separators. */
  national: string;
  /** Trailing extension digits ("x123"), or null. */
  ext: string | null;
  /** The original input, trimmed. */
  raw: string;
  /** True once at least one national digit was recovered. */
  valid: boolean;
};

// A small table of country calling codes, longest first so the prefix match is
// greedy (so "1" never shadows "1..."). Only consulted when the input opens
// with an explicit international prefix (`+` or `00`); a bare local number
// keeps all its digits in `national`.
const COUNTRY_CODES = [
  "971",
  "972",
  "353",
  "358",
  "420",
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
  "61",
  "64",
  "91",
  "81",
  "86",
  "52",
  "55",
  "48",
  "43",
  "32",
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
    const cc = COUNTRY_CODES.find((code) => significant.startsWith(code));
    if (cc && significant.length > cc.length) {
      countryCode = cc;
      national = significant.slice(cc.length);
    }
  }

  return { countryCode, national, ext, raw, valid: national.length > 0 };
}

/** Group a run of digits into readable space-separated chunks. */
function groupDigits(digits: string, size = 3): string {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += size) {
    groups.push(digits.slice(i, i + size));
  }
  return groups.join(" ");
}

/** Render a parsed phone number in the chosen style. `raw` echoes the input
 *  untouched; the others regroup the digits and either keep, drop, or compact
 *  the country code. An unparseable value always falls back to its raw form. */
export function formatPhone(parsed: ParsedPhone, format: PhoneFormat): string {
  if (format === "raw" || !parsed.valid) return parsed.raw;

  const { countryCode, national, ext } = parsed;

  if (format === "e164") {
    // Compact, separator-free — the shape sync/import tools want. E.164 has no
    // notion of an extension, so it rides along as a trailing "x".
    const core = countryCode ? `+${countryCode}${national}` : national;
    return ext ? `${core}x${ext}` : core;
  }

  const extSuffix = ext ? ` ext. ${ext}` : "";
  const body = groupDigits(national);
  if (format === "national") return `${body}${extSuffix}`;
  // international
  const withCc = countryCode ? `+${countryCode} ${body}` : body;
  return `${withCc}${extSuffix}`;
}

/** Convenience wrapper: parse then format in one call. */
export function formatPhoneValue(input: string, format: PhoneFormat): string {
  return formatPhone(parsePhone(input), format);
}

// --- Postal code -------------------------------------------------------------

/** How a postal / ZIP code is shown. */
export type ZipFormat = "raw" | "us5" | "us9" | "spaced";

export const ZIP_FORMATS: readonly ZipFormat[] = [
  "raw",
  "us5",
  "us9",
  "spaced",
] as const;

/** Render a postal code in the chosen style. `raw` is untouched; the US styles
 *  clamp to a 5- or 9-digit ZIP, and `spaced` splits the last two digits off
 *  (the Swedish "123 45" grouping). A value with no digits is returned as-is. */
export function formatZip(input: string, format: ZipFormat): string {
  const raw = input.trim();
  if (format === "raw") return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  switch (format) {
    case "us5":
      return digits.slice(0, 5);
    case "us9":
      return digits.length > 5
        ? `${digits.slice(0, 5)}-${digits.slice(5, 9)}`
        : digits.slice(0, 5);
    case "spaced":
      return digits.length > 2
        ? `${digits.slice(0, digits.length - 2)} ${digits.slice(-2)}`
        : digits;
    default:
      return raw;
  }
}
