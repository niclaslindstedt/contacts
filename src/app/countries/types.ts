// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The seam that makes formatting country-based. A country is a value that knows
// how to render the value-shaped fields (phone numbers, postal codes) in its
// own convention; the rest of the app never hard-codes a single country's
// rules, it just asks the selected country to format. Adding a country means
// adding one file under `countries/` that implements `CountryFormat` and
// registering it in `index.ts` — nothing else in the app changes.

import type { ParsedPhone } from "../format.ts";

/** The user-facing knobs the Format tab exposes for phone display. A country's
 *  formatter interprets these against its own convention; an option a country
 *  has no use for is simply ignored (the US has no trunk 0, so `leadingZero`
 *  is a no-op there). Keeping the option set small and generic is what lets
 *  the settings surface stay the same as countries are added. */
export type PhoneOptions = {
  /** Format at all. When false the number is shown exactly as entered. */
  format: boolean;
  /** Prefix the international calling code (+46 / +1). */
  countryCode: boolean;
  /** Show the national trunk prefix / leading zero where the country has one
   *  (Sweden's `(0)` / `0`). No effect in countries without a trunk digit. */
  leadingZero: boolean;
};

/** The user-facing knobs for postal / ZIP display. */
export type PostalOptions = {
  /** Format at all. When false the code is shown exactly as entered. */
  format: boolean;
  /** Group the code with spaces where the country's convention allows it
   *  (Sweden's `123 45`). No effect where the country groups another way. */
  spaces: boolean;
};

/** Representative values the Format tab previews a country's options with. */
export type CountrySamples = {
  readonly phone: string;
  readonly postal: string;
};

/** What every country provides. Pure functions over the already-parsed inputs —
 *  no DOM, no settings hook — so each country is unit-testable on its own. */
export interface CountryFormat {
  /** ISO 3166-1 alpha-2 code, uppercase ("SE", "US"). The stable identifier
   *  stored in settings. */
  readonly code: string;
  /** E.164 calling code without the plus ("46", "1"). Used to route a number
   *  that carries its own country code to the country it belongs to. */
  readonly callingCode: string;
  /** Flag emoji for the country picker. */
  readonly flag: string;
  /** i18n key stem under `settings.format.country.<nameKey>`. */
  readonly nameKey: string;
  /** Sample values the settings tab previews this country's options with. */
  readonly samples: CountrySamples;

  /** Render a parsed phone number in this country's convention. The country
   *  code / national split has already been done by `parsePhone`; the country
   *  only decides grouping and how the options are applied. */
  formatPhone(parsed: ParsedPhone, opts: PhoneOptions): string;

  /** Render a postal / ZIP code in this country's convention. */
  formatPostal(input: string, opts: PostalOptions): string;
}
