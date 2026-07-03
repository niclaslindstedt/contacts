// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Sweden. The whole of "how Sweden formats a phone number or a postal code"
// lives here and nowhere else — the app core only knows it holds a
// `CountryFormat`.
//
// Phone: national numbers are written `areacode-subscriber`, with the
// subscriber part grouped "three together if possible, otherwise pairs"
// (`076-818 13 37`). The single trunk `0` is written plainly in the national
// form and parenthesised `(0)` alongside an international `+46` prefix, because
// it is dropped when dialling in but kept when writing the number down:
// `+46 (0)76-818 13 37`.
//
// Postal: five digits written `xxx xx` — a space after the third digit.

import {
  digitsOnly,
  extSuffix,
  groupPairsLeadingTriple,
  type ParsedPhone,
} from "../format.ts";
import type { CountryFormat, PhoneOptions, PostalOptions } from "./types.ts";

// Swedish area codes are the digits after the single trunk 0 and vary in
// length. Rather than carry the full numbering plan, we classify by the parts
// the plan makes regular:
//   • Stockholm is a lone `8`             → 1 digit
//   • mobile and non-geographic services  → 2 digits (07x, 010, 020, 070–079…)
//   • a set of two-digit city codes       → 2 digits
//   • everything else                     → 3 digits
// Extend `TWO_DIGIT_AREAS` as needed; it is the one place Swedish area-code
// lengths are encoded.
const TWO_DIGIT_AREAS = new Set([
  "10",
  "11",
  "13",
  "16",
  "18",
  "19",
  "20",
  "21",
  "23",
  "26",
  "31",
  "33",
  "36",
  "40",
  "42",
  "44",
  "46",
  "54",
  "60",
  "63",
  "90",
]);

/** Split national significant digits (no trunk 0) into [areaCode, subscriber].
 *  Stockholm is a lone `8` (1 digit); mobile / non-geographic services and the
 *  listed city codes are 2; everything else is a 3-digit area code. */
function splitArea(sig: string): [string, string] {
  const len = sig.startsWith("8")
    ? 1
    : sig.startsWith("7") || TWO_DIGIT_AREAS.has(sig.slice(0, 2))
      ? 2
      : 3;
  return [sig.slice(0, len), sig.slice(len)];
}

export const SE: CountryFormat = {
  code: "SE",
  callingCode: "46",
  flag: "🇸🇪",
  nameKey: "se",
  samples: { phone: "+46768181337", postal: "12345" },

  formatPhone(parsed: ParsedPhone, opts: PhoneOptions): string {
    // Drop any trunk 0 the number was typed with; Sweden carries exactly one,
    // which we re-add (or not) per the leading-zero option below.
    const sig = parsed.national.replace(/^0+/, "");
    if (!sig) return parsed.raw;

    const [area, subscriber] = splitArea(sig);
    const grouped = groupPairsLeadingTriple(subscriber);
    const local = grouped ? `${area}-${grouped}` : area;

    // The trunk 0: parenthesised next to +46, plain otherwise, gone when off.
    let out: string;
    if (opts.countryCode) {
      const trunk = opts.leadingZero ? "(0)" : "";
      out = `+${SE.callingCode} ${trunk}${local}`;
    } else {
      const trunk = opts.leadingZero ? "0" : "";
      out = `${trunk}${local}`;
    }
    return `${out}${extSuffix(parsed.ext)}`;
  },

  formatPostal(input: string, opts: PostalOptions): string {
    const digits = digitsOnly(input);
    if (!digits) return input.trim();
    const five = digits.slice(0, 5);
    if (!opts.spaces || five.length <= 3) return five;
    return `${five.slice(0, 3)} ${five.slice(3)}`;
  },
};
