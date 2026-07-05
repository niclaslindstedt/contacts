// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The country registry and the dispatch that turns a stored value into its
// displayed shape. This is the only place that knows the *set* of countries;
// each country's rules live in its own module. To add a country, implement
// `CountryFormat` in a new file and add it to `COUNTRIES` — the settings tab,
// the read view, and the tests pick it up from here.

import { parsePhone } from "../format.ts";
import type { CountryFormat, PhoneOptions, PostalOptions } from "./types.ts";
import { SE } from "./se.ts";
import { US } from "./us.ts";
import { CATALOG } from "./catalog.ts";

export type { CountryFormat, PhoneOptions, PostalOptions } from "./types.ts";

/** Every country the app can format for. Sweden leads (it is the default);
 *  the United States and the rest of the developed-country catalogue follow.
 *  The picker sorts them by localised name, so this order is only the registry
 *  order, not what the user sees. */
export const COUNTRIES: readonly CountryFormat[] = [
  SE,
  US,
  ...CATALOG,
] as const;

/** The stable identifier stored in settings — the union of registered codes. */
export type CountryCode = (typeof COUNTRIES)[number]["code"];

/** The country used when nothing else matches. */
export const DEFAULT_COUNTRY: CountryCode = SE.code;

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

// A calling code can be shared (the US and Canada both own +1). The map keeps
// the first-registered country for a code — which is fine because countries
// sharing a calling code also share a numbering plan, so either formats an
// ambiguous `+1` number identically.
const BY_CALLING_CODE = new Map<string, CountryFormat>();
for (const c of COUNTRIES) {
  if (!BY_CALLING_CODE.has(c.callingCode))
    BY_CALLING_CODE.set(c.callingCode, c);
}

/** The country for a stored code, falling back to the default when unknown
 *  (e.g. a code left behind by a country that was later removed). */
export function getCountry(code: string): CountryFormat {
  return BY_CODE.get(code) ?? BY_CODE.get(DEFAULT_COUNTRY)!;
}

/** The country that owns a given E.164 calling code, or null when unregistered
 *  ("46" → Sweden; "999" → null). */
export function getCountryByCallingCode(
  cc: string | null,
): CountryFormat | null {
  return cc ? (BY_CALLING_CODE.get(cc) ?? null) : null;
}

// --- Value dispatch ----------------------------------------------------------
// The options the callers pass carry the *home* country plus the display
// knobs. A number that carries its own calling code is routed to the country
// it belongs to; a bare number is formatted for the home country. This is what
// lets a Swedish address book show a US number as `+1 (202) 555-0100` while
// everything local reads Swedish.

/** Format a free-typed phone number for display. */
export function formatPhoneValue(
  input: string,
  home: CountryCode,
  opts: PhoneOptions,
): string {
  if (!opts.format) return input.trim() || input;
  const parsed = parsePhone(input);
  if (!parsed.valid) return parsed.raw;
  const country =
    getCountryByCallingCode(parsed.countryCode) ?? getCountry(home);
  return country.formatPhone(parsed, opts);
}

/** Format a postal / ZIP code for display, always in the home country's
 *  convention (a bare postal code carries no country of its own). */
export function formatPostalValue(
  input: string,
  home: CountryCode,
  opts: PostalOptions,
): string {
  if (!opts.format) return input.trim() || input;
  return getCountry(home).formatPostal(input, opts);
}
