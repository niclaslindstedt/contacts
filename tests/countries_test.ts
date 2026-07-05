// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  formatPhoneValue,
  formatPostalValue,
  formatStoredPhone,
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

describe("formatStoredPhone", () => {
  it("formats a stored phone by its own calling code", () => {
    expect(
      formatStoredPhone(
        { value: "768181337", countryCode: "46" },
        "US",
        phone(),
      ),
    ).toBe("+46 (0)76-818 13 37");
  });

  it("formats a code-less stored phone for the home country", () => {
    expect(formatStoredPhone({ value: "768181337" }, "SE", phone())).toBe(
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

// --- The developed-country catalogue ----------------------------------------
// Sweden and the US are exercised in depth above; these pin the shared factory
// and a representative slice of the catalogue's own rules.

describe("developed-country catalogue", () => {
  it("registers thirty countries, Sweden the default", () => {
    expect(COUNTRIES).toHaveLength(30);
    expect(DEFAULT_COUNTRY).toBe("SE");
    expect(getCountry("SE").code).toBe("SE");
    // Every code is unique.
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
  });

  it("routes the new calling codes to their country", () => {
    expect(getCountryByCallingCode("33")?.code).toBe("FR");
    expect(getCountryByCallingCode("81")?.code).toBe("JP");
    expect(getCountryByCallingCode("358")?.code).toBe("FI");
    // The US and Canada share +1; the first-registered (US) wins the lookup.
    expect(getCountryByCallingCode("1")?.code).toBe("US");
  });
});

describe("catalogue phone conventions", () => {
  it("groups France in pairs with the trunk 0 inside them", () => {
    expect(formatPhoneValue("+33612345678", "FR", phone())).toBe(
      "+33 (0)6 12 34 56 78",
    );
    expect(
      formatPhoneValue("+33612345678", "FR", phone({ countryCode: false })),
    ).toBe("06 12 34 56 78");
  });

  it("groups a Danish number in even pairs (no trunk 0)", () => {
    expect(formatPhoneValue("+4520123456", "DK", phone())).toBe(
      "+45 20 12 34 56",
    );
  });

  it("groups a Norwegian mobile 3-2-3", () => {
    expect(formatPhoneValue("+4795123456", "NO", phone())).toBe(
      "+47 951 23 456",
    );
  });

  it("writes a Canadian number in the NANP shape", () => {
    expect(formatPhoneValue("+14165550123", "CA", phone())).toBe(
      "+1 (416) 555-0123",
    );
  });

  it("writes a Japanese mobile as 090 1234 5678", () => {
    expect(
      formatPhoneValue("+819012345678", "JP", phone({ countryCode: false })),
    ).toBe("090 1234 5678");
  });

  it("keeps a typed leading 0 where the country has no trunk (Italy)", () => {
    // Italy dials its 0, so it is kept rather than stripped.
    expect(
      formatPhoneValue("06 1234 5678", "IT", phone({ countryCode: false })),
    ).toMatch(/^0/);
  });

  it("drops the trunk digit when the leading-zero option is off", () => {
    expect(
      formatPhoneValue("+33612345678", "FR", phone({ leadingZero: false })),
    ).toBe("+33 6 12 34 56 78");
  });

  it("routes a foreign number to its own country regardless of home", () => {
    // A French number in a Swedish address book still reads French.
    expect(formatPhoneValue("+33612345678", "SE", phone())).toBe(
      "+33 (0)6 12 34 56 78",
    );
  });
});

describe("catalogue postal conventions", () => {
  it("splits Portugal, Japan, and Poland on their fixed hyphen", () => {
    expect(formatPostalValue("1000100", "PT", postal())).toBe("1000-100");
    expect(formatPostalValue("1000001", "JP", postal())).toBe("100-0001");
    expect(formatPostalValue("00950", "PL", postal())).toBe("00-950");
  });

  it("spaces Czech and Greek codes like Sweden's, honouring the toggle", () => {
    expect(formatPostalValue("11000", "CZ", postal())).toBe("110 00");
    expect(formatPostalValue("10431", "GR", postal())).toBe("104 31");
    expect(formatPostalValue("11000", "CZ", postal({ spaces: false }))).toBe(
      "11000",
    );
  });

  it("groups the alphanumeric UK, Canadian, and Dutch codes", () => {
    expect(formatPostalValue("sw1a1aa", "GB", postal())).toBe("SW1A 1AA");
    expect(formatPostalValue("k1a0b1", "CA", postal())).toBe("K1A 0B1");
    expect(formatPostalValue("1012ab", "NL", postal())).toBe("1012 AB");
  });

  it("leaves a plain-digit country ungrouped (Norway)", () => {
    expect(formatPostalValue("0150", "NO", postal())).toBe("0150");
    expect(formatPostalValue("0150", "NO", postal({ spaces: false }))).toBe(
      "0150",
    );
  });
});
