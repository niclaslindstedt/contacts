// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  formatPhoneValue,
  formatPostalValue,
  getCountry,
  getCountryByCallingCode,
  type PhoneOptions,
  type PostalOptions,
} from "../src/app/countries/index.ts";

// Handy option presets so each assertion reads as "with these knobs".
const phone = (o: Partial<PhoneOptions> = {}): PhoneOptions => ({
  format: true,
  countryCode: true,
  leadingZero: true,
  ...o,
});
const postal = (o: Partial<PostalOptions> = {}): PostalOptions => ({
  format: true,
  spaces: true,
  ...o,
});

describe("registry", () => {
  it("routes a code to its country and falls back for the unknown", () => {
    expect(getCountry("US").code).toBe("US");
    expect(getCountry("ZZ").code).toBe(DEFAULT_COUNTRY);
  });

  it("routes a calling code to the country that owns it", () => {
    expect(getCountryByCallingCode("46")?.code).toBe("SE");
    expect(getCountryByCallingCode("1")?.code).toBe("US");
    expect(getCountryByCallingCode("999")).toBeNull();
    expect(getCountryByCallingCode(null)).toBeNull();
  });

  it("exposes a sample pair for every registered country", () => {
    for (const c of COUNTRIES) {
      expect(c.samples.phone.length).toBeGreaterThan(0);
      expect(c.samples.postal.length).toBeGreaterThan(0);
    }
  });
});

describe("Sweden phone", () => {
  it("writes the headline mobile form with (0) beside +46", () => {
    expect(formatPhoneValue("+46768181337", "SE", phone())).toBe(
      "+46 (0)76-818 13 37",
    );
  });

  it("honours the leading-zero and country-code toggles", () => {
    // National, with the plain trunk 0.
    expect(
      formatPhoneValue("+46768181337", "SE", phone({ countryCode: false })),
    ).toBe("076-818 13 37");
    // No trunk digit, keep +46.
    expect(
      formatPhoneValue("+46768181337", "SE", phone({ leadingZero: false })),
    ).toBe("+46 76-818 13 37");
    // Neither.
    expect(
      formatPhoneValue("+46768181337", "SE", {
        format: true,
        countryCode: false,
        leadingZero: false,
      }),
    ).toBe("76-818 13 37");
  });

  it("formats a bare local number typed with its trunk 0", () => {
    expect(formatPhoneValue("076-818 13 37", "SE", phone())).toBe(
      "+46 (0)76-818 13 37",
    );
  });

  it("treats Stockholm as a one-digit area code", () => {
    expect(
      formatPhoneValue("08-123 45 67", "SE", phone({ countryCode: false })),
    ).toBe("08-123 45 67");
  });

  it("groups an even subscriber part in pairs", () => {
    // Gothenburg 031 + six-digit subscriber → 2 2 2.
    expect(
      formatPhoneValue("031-123456", "SE", phone({ countryCode: false })),
    ).toBe("031-12 34 56");
  });
});

describe("United States phone", () => {
  it("writes the canonical (NPA) NXX-XXXX form", () => {
    expect(formatPhoneValue("+12025550100", "US", phone())).toBe(
      "+1 (202) 555-0100",
    );
    expect(
      formatPhoneValue("2025550100", "US", phone({ countryCode: false })),
    ).toBe("(202) 555-0100");
  });

  it("ignores the leading-zero option (no trunk digit)", () => {
    expect(
      formatPhoneValue("+12025550100", "US", phone({ leadingZero: true })),
    ).toBe(
      formatPhoneValue("+12025550100", "US", phone({ leadingZero: false })),
    );
  });

  it("carries an extension through", () => {
    expect(
      formatPhoneValue(
        "+1 202 555 0100 x42",
        "US",
        phone({ countryCode: false }),
      ),
    ).toBe("(202) 555-0100 ext. 42");
  });
});

describe("dispatch by embedded country code", () => {
  it("formats a foreign number for its own country regardless of home", () => {
    // Home is Sweden, but a +1 number renders American.
    expect(formatPhoneValue("+12025550100", "SE", phone())).toBe(
      "+1 (202) 555-0100",
    );
    // Home is the US, but a +46 number renders Swedish.
    expect(formatPhoneValue("+46768181337", "US", phone())).toBe(
      "+46 (0)76-818 13 37",
    );
  });

  it("uses the home country for a bare number", () => {
    expect(formatPhoneValue("768181337", "SE", phone())).toBe(
      "+46 (0)76-818 13 37",
    );
  });
});

describe("format master switch", () => {
  it("shows a phone exactly as entered when off", () => {
    expect(
      formatPhoneValue("+46 (0)76-818 13 37", "SE", phone({ format: false })),
    ).toBe("+46 (0)76-818 13 37");
  });

  it("falls back to raw when nothing parses", () => {
    expect(formatPhoneValue("n/a", "SE", phone())).toBe("n/a");
  });
});

describe("postal codes", () => {
  it("renders the Swedish five-digit xxx xx form, spaces optional", () => {
    expect(formatPostalValue("12345", "SE", postal())).toBe("123 45");
    expect(formatPostalValue("12345", "SE", postal({ spaces: false }))).toBe(
      "12345",
    );
    // Clamped to five; a short draft stays untouched.
    expect(formatPostalValue("123456789", "SE", postal())).toBe("123 45");
    expect(formatPostalValue("12", "SE", postal())).toBe("12");
  });

  it("renders a US ZIP and ZIP+4", () => {
    expect(formatPostalValue("12345", "US", postal())).toBe("12345");
    expect(formatPostalValue("123456789", "US", postal())).toBe("12345-6789");
    // The spaces toggle is a no-op for the US.
    expect(
      formatPostalValue("123456789", "US", postal({ spaces: false })),
    ).toBe("12345-6789");
  });

  it("shows a code exactly as entered when off", () => {
    expect(formatPostalValue("12345", "SE", postal({ format: false }))).toBe(
      "12345",
    );
  });

  it("returns a digitless value as-is", () => {
    expect(formatPostalValue("N/A", "US", postal())).toBe("N/A");
  });
});
