// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The shared toolkit the country modules build their rules from. `se.ts` and
// `us.ts` are the hand-written reference implementations of `CountryFormat`;
// every other country is assembled from this small kit of pure helpers plus a
// data row (see `catalog.ts`). Nothing here knows the *set* of countries — it
// only expresses the handful of grouping conventions those countries pick from,
// so adding a country is a data change, not new formatting logic.
//
// Everything is a pure function over strings, so a country built with `defineCountry`
// is exactly as unit-testable as a hand-written one.

import {
  digitsOnly,
  extSuffix,
  groupDigits,
  type ParsedPhone,
} from "../format.ts";
import type {
  CountryFormat,
  CountrySamples,
  PhoneOptions,
  PostalOptions,
} from "./types.ts";

// --- Phone grouping ----------------------------------------------------------
// A grouper takes the national significant digits (country code already peeled,
// trunk 0 already handled by the caller) and returns them split into the
// country's readable clumps. The trunk digit and the +cc prefix are added by
// `defineCountry` around whatever the grouper produces.

/** A grouping of national significant digits into space-separated clumps. */
export type PhoneGrouper = (national: string) => string;

/** Consume `lead` chunks of the given sizes off the front, then split whatever
 *  remains into `rest`-sized chunks. Expresses almost every national grouping:
 *  `pattern([3], 2)` → `"612 34 56 78"`, `pattern([2], 99)` → `"40 1234567"`
 *  (a lone area code then the subscriber as one block). */
export function pattern(lead: readonly number[], rest = 3): PhoneGrouper {
  return (national) => {
    const parts: string[] = [];
    let i = 0;
    for (const size of lead) {
      if (i >= national.length) break;
      parts.push(national.slice(i, i + size));
      i += size;
    }
    for (; i < national.length; i += rest)
      parts.push(national.slice(i, i + rest));
    return parts.join(" ");
  };
}

/** Even pairs from the left: `"20123456"` → `"20 12 34 56"`. */
export const pairs: PhoneGrouper = pattern([], 2);

/** Even triples from the left: `"601123456"` → `"601 123 456"`. */
export const triples: PhoneGrouper = pattern([], 3);

/** The North American Numbering Plan's `(NPA) NXX-XXXX`. A partial draft falls
 *  back to plain triples so it stays readable while being typed. */
export const nanp: PhoneGrouper = (national) =>
  national.length === 10
    ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
    : groupDigits(national);

// --- Postal grouping ---------------------------------------------------------
// A postal formatter takes the raw input and the options and returns the
// display form. Numeric conventions run on the digits; the alphanumeric ones
// (UK, Canada, the Netherlands, Ireland) run on the uppercased alphanumerics.

/** A postal-code display rule. */
export type PostalFormatter = (input: string, opts: PostalOptions) => string;

/** N digits, no grouping — `spaces` is a no-op (e.g. Norway's `0150`). */
export function plainPostal(len: number): PostalFormatter {
  return (input) => {
    const d = digitsOnly(input).slice(0, len);
    return d || input.trim();
  };
}

/** N digits with a single optional space after `at` (Sweden's `123 45`); the
 *  space follows the `spaces` toggle. */
export function spacedPostal(len: number, at: number): PostalFormatter {
  return (input, opts) => {
    const d = digitsOnly(input).slice(0, len);
    if (!d) return input.trim();
    if (!opts.spaces || d.length <= at) return d;
    return `${d.slice(0, at)} ${d.slice(at)}`;
  };
}

/** N digits split by a fixed hyphen after `at` once the extra digits are
 *  present (Japan's `100-0001`, a US ZIP+4). The hyphen is convention, so the
 *  `spaces` toggle is a no-op. */
export function hyphenPostal(len: number, at: number): PostalFormatter {
  return (input) => {
    const d = digitsOnly(input).slice(0, len);
    if (!d) return input.trim();
    return d.length > at ? `${d.slice(0, at)}-${d.slice(at)}` : d;
  };
}

/** Uppercase and drop everything but letters and digits. */
const alnum = (input: string): string =>
  input.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Alphanumeric code with an optional space after the first `n` characters
 *  (Canada's `K1A 0B1`, a Dutch `1234 AB`). */
export function alnumAfter(n: number): PostalFormatter {
  return (input, opts) => {
    const s = alnum(input);
    if (!s) return input.trim();
    if (!opts.spaces || s.length <= n) return s;
    return `${s.slice(0, n)} ${s.slice(n)}`;
  };
}

/** Alphanumeric code with an optional space before the final `n` characters —
 *  the UK's outward/inward split (`SW1A 1AA`). */
export function alnumTail(n: number): PostalFormatter {
  return (input, opts) => {
    const s = alnum(input);
    if (!s) return input.trim();
    if (!opts.spaces || s.length <= n) return s;
    return `${s.slice(0, -n)} ${s.slice(-n)}`;
  };
}

// --- Country factory ---------------------------------------------------------

/** The data a data-driven country is built from. The formatting *logic* is the
 *  grouper and postal formatter picked from the kit above; everything else is
 *  identity and sample data. */
export type CountrySpec = {
  readonly code: string;
  readonly callingCode: string;
  readonly flag: string;
  readonly nameKey: string;
  readonly samples: CountrySamples;
  /** Whether the country writes a national trunk `0` (most of Europe). When
   *  true the trunk is stripped off the national digits before grouping and
   *  re-added per the leading-zero option; when false the number is grouped
   *  exactly as its digits stand (Italy keeps its `0`, the US has none). */
  readonly trunk?: boolean;
  readonly group: PhoneGrouper;
  readonly postal: PostalFormatter;
};

/** Turn a spec into a full `CountryFormat`. The phone method is the one shared
 *  shape: peel/strip the trunk, group the national part, then wrap it with the
 *  trunk digit and `+cc` prefix the options ask for — the same rules `se.ts`
 *  spells out by hand, so a data-driven country and a hand-written one behave
 *  identically. */
export function defineCountry(spec: CountrySpec): CountryFormat {
  const trunk = spec.trunk ?? false;
  return {
    code: spec.code,
    callingCode: spec.callingCode,
    flag: spec.flag,
    nameKey: spec.nameKey,
    samples: spec.samples,

    formatPhone(parsed: ParsedPhone, opts: PhoneOptions): string {
      // A trunk country carries exactly one leading 0, dropped here and re-added
      // (or not) below; a non-trunk country keeps its digits as they stand.
      const sig = trunk ? parsed.national.replace(/^0+/, "") : parsed.national;
      if (!sig) return parsed.raw;

      const local = spec.group(sig);
      let out: string;
      if (opts.countryCode) {
        const lead = trunk && opts.leadingZero ? "(0)" : "";
        out = `+${spec.callingCode} ${lead}${local}`;
      } else {
        const lead = trunk && opts.leadingZero ? "0" : "";
        out = `${lead}${local}`;
      }
      return `${out}${extSuffix(parsed.ext)}`;
    },

    formatPostal: spec.postal,
  };
}
