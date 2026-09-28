// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The region a device's locale tag speaks for — what the home country and the
// date format read to seed a new install (`countryFromLocales`,
// `dateFormatFromLocales`). A saved setting always wins over either.

/**
 * The region a locale tag names ("en-US" → "US", "de-DE" → "DE"), or, for a
 * bare language, its likeliest region ("sv" → "SE", "fi" → "FI") — except
 * where that likeliest region is the United States. A bare "en" is English
 * spoken anywhere, not an American device, so it names no region and the
 * caller moves on to the next tag or its own non-US default. Undefined for a
 * tag that does not parse.
 */
export function localeRegion(tag: string): string | undefined {
  let locale: Intl.Locale;
  try {
    locale = new Intl.Locale(tag);
  } catch {
    return undefined;
  }
  if (locale.region) return locale.region;
  const likely = locale.maximize().region;
  return likely === "US" ? undefined : likely;
}
