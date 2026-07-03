// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The United States. All of "how the US formats a phone number or a ZIP code"
// lives here.
//
// Phone: the North American Numbering Plan writes a ten-digit number as
// `(NPA) NXX-XXXX` — `(202) 555-0100` — with an optional `+1` country prefix.
// There is no trunk 0, so the leading-zero option is a no-op.
//
// Postal: a five-digit ZIP, or ZIP+4 written `12345-6789` when the extra four
// digits are present. The hyphen is fixed convention, so the spaces option is
// a no-op.

import {
  digitsOnly,
  extSuffix,
  groupDigits,
  type ParsedPhone,
} from "../format.ts";
import type { CountryFormat, PhoneOptions, PostalOptions } from "./types.ts";

export const US: CountryFormat = {
  code: "US",
  callingCode: "1",
  flag: "🇺🇸",
  nameKey: "us",
  samples: { phone: "+12025550100", postal: "123456789" },

  formatPhone(parsed: ParsedPhone, opts: PhoneOptions): string {
    const sig = parsed.national;
    if (!sig) return parsed.raw;

    // A full ten-digit number gets the canonical (NPA) NXX-XXXX shape; a
    // partial draft falls back to plain triples so it stays readable.
    const local =
      sig.length === 10
        ? `(${sig.slice(0, 3)}) ${sig.slice(3, 6)}-${sig.slice(6)}`
        : groupDigits(sig);

    const out = opts.countryCode ? `+${US.callingCode} ${local}` : local;
    return `${out}${extSuffix(parsed.ext)}`;
  },

  formatPostal(input: string, _opts: PostalOptions): string {
    const digits = digitsOnly(input);
    if (!digits) return input.trim();
    return digits.length > 5
      ? `${digits.slice(0, 5)}-${digits.slice(5, 9)}`
      : digits.slice(0, 5);
  },
};
