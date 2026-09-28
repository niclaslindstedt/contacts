// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The home country and the date format a new install starts with follow the
// device; the ones an existing install saved never move.
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  defaultSettings,
  parseSettings,
} from "../src/app/useAppSettings.ts";

describe("defaultSettings", () => {
  it("starts a US device in the United States", () => {
    expect(defaultSettings(["en-US"]).country).toBe("US");
  });

  it("starts a Swedish device in Sweden", () => {
    expect(defaultSettings(["sv-SE"]).country).toBe("SE");
  });

  it("writes dates month first on a US device", () => {
    expect(defaultSettings(["en-US"]).dateFormat).toBe("us");
  });

  it("writes dates the ISO way on a Swedish device", () => {
    expect(defaultSettings(["sv-SE"]).dateFormat).toBe("iso");
  });

  it("writes dates day first where the region does", () => {
    expect(defaultSettings(["nb-NO"]).dateFormat).toBe("eu");
    expect(defaultSettings(["en-GB"]).dateFormat).toBe("eu");
  });

  it("keeps every other default", () => {
    expect(defaultSettings(["en-US"])).toEqual({
      ...DEFAULT_SETTINGS,
      country: "US",
      dateFormat: "us",
    });
  });
});

describe("parseSettings", () => {
  const usDevice = defaultSettings(["en-US"]);

  it("keeps a saved home country on a device in another region", () => {
    const saved = JSON.stringify({ ...DEFAULT_SETTINGS, country: "SE" });
    expect(parseSettings(saved, usDevice).country).toBe("SE");
  });

  it("keeps a saved date format on a device in another region", () => {
    const saved = JSON.stringify({ ...DEFAULT_SETTINGS, dateFormat: "iso" });
    expect(parseSettings(saved, usDevice).dateFormat).toBe("iso");
  });

  it("follows the device only for what was never saved", () => {
    const saved = JSON.stringify({ menuMode: "swipe" });
    const parsed = parseSettings(saved, usDevice);
    expect(parsed.menuMode).toBe("swipe");
    expect(parsed.country).toBe("US");
    expect(parsed.dateFormat).toBe("us");
  });

  it("still carries a legacy Swedish postal choice forward", () => {
    const saved = JSON.stringify({ zipFormat: "se" });
    expect(parseSettings(saved, usDevice).country).toBe("SE");
  });

  it("falls back to the device's defaults for a corrupt blob", () => {
    expect(parseSettings("[]", usDevice)).toEqual(usDevice);
  });
});
