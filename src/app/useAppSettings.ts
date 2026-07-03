// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import { useLocalStorageState } from "./useLocalStorageState.ts";
import type { DateFormat } from "./format.ts";
import {
  DEFAULT_COUNTRY,
  type CountryCode,
  type PhoneOptions,
  type PostalOptions,
} from "./countries/index.ts";

// The app's own (non-theme) settings — how the side menu opens, achievements,
// developer mode, log capture, and the display formats for dates / phone
// numbers / postal codes. The framework deliberately leaves this in the app;
// it only owns the appearance projection. (The active *language* is owned by
// the framework i18n runtime — see `i18n/index.ts`.) Persisted to localStorage
// so a reload keeps your choices.
//
// Formatting is *country-based*: you pick a home country, and the country
// decides how phones and postal codes are shaped (see `countries/`). The
// booleans here are the country-agnostic knobs the Format tab exposes; each
// country interprets them against its own convention.

export type MenuMode = "swipe" | "button";

export type AppSettings = {
  menuMode: MenuMode;
  disableAchievements: boolean;
  devMode: boolean;
  captureLogs: boolean;
  // How value-shaped fields render. These affect display only; the stored
  // value stays exactly as the user typed it.
  dateFormat: DateFormat;
  /** The home country whose conventions phones/postal codes follow. */
  country: CountryCode;
  /** Format phone numbers at all (off ⇒ shown exactly as entered). */
  phoneFormat: boolean;
  /** Prefix the international calling code (+46 / +1). */
  phoneCountryCode: boolean;
  /** Show the national trunk prefix / leading zero where the country has one. */
  phoneLeadingZero: boolean;
  /** Format postal codes at all (off ⇒ shown exactly as entered). */
  postalFormat: boolean;
  /** Group the postal code with spaces where the country allows it. */
  postalSpaces: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  // The discoverable default on phones: a floating sidebar button. Switching to
  // "swipe" hides it and opens the drawer with an inward edge swipe instead.
  menuMode: "button",
  // Achievements ship on so the trophy button and its modals are discoverable
  // out of the box; the General tab can switch them off.
  disableAchievements: false,
  devMode: false,
  captureLogs: false,
  // Dates default to ISO; phone/postal formatting defaults *off*, so an
  // existing document reads exactly as typed until the owner opts in and picks
  // a country. Once on, the country's convention takes over.
  dateFormat: "iso",
  country: DEFAULT_COUNTRY,
  phoneFormat: false,
  phoneCountryCode: true,
  phoneLeadingZero: true,
  postalFormat: false,
  postalSpaces: true,
};

const STORAGE_KEY = "contacts:settings";

// The pre-country display settings this replaces stored a single style string
// per field (`phoneFormat: "swedish"`, `zipFormat: "us9"`). Carry those choices
// forward into the country model so an upgrade doesn't silently reset a user's
// picks. Only runs when the new `country` key is absent (i.e. a v1 blob).
type LegacyKeys = { phoneFormat?: unknown; zipFormat?: unknown };

function migrateLegacy(
  merged: AppSettings,
  stored: Record<string, unknown>,
): AppSettings {
  if (typeof stored.country === "string") return merged; // already v2
  const next = { ...merged };
  const { phoneFormat, zipFormat } = stored as LegacyKeys;

  if (typeof phoneFormat === "string") {
    next.phoneFormat = phoneFormat !== "raw";
    if (phoneFormat === "swedish") next.country = "SE";
    next.phoneCountryCode =
      phoneFormat === "international" || phoneFormat === "e164";
  }
  if (typeof zipFormat === "string") {
    next.postalFormat = zipFormat !== "raw";
    if (zipFormat === "se") next.country = "SE";
    else if (zipFormat === "us5" || zipFormat === "us9") next.country = "US";
    next.postalSpaces = zipFormat === "se" || zipFormat === "spaced";
  }
  return next;
}

function parseSettings(raw: string): AppSettings {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_SETTINGS;
  }
  const stored = parsed as Record<string, unknown>;
  const merged = { ...DEFAULT_SETTINGS, ...stored } as AppSettings;
  return migrateLegacy(merged, stored);
}

export function useAppSettings() {
  // The framework hook owns the persistence mechanics (safe parse, write-
  // through); this store owns the key, the settings shape, and the v1→v2
  // migration of the display formats.
  const [settings, setSettings] = useLocalStorageState<AppSettings>(
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    { parse: parseSettings },
  );

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [setSettings],
  );

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [setSettings]);

  return { settings, update, reset, setSettings };
}

// --- Settings → country options ----------------------------------------------
// The Format tab and the read view render through the country dispatch, which
// takes plain option objects rather than the whole settings blob. These two
// adapters are the single mapping from persisted booleans to those options.

export function phoneOptions(s: AppSettings): PhoneOptions {
  return {
    format: s.phoneFormat,
    countryCode: s.phoneCountryCode,
    leadingZero: s.phoneLeadingZero,
  };
}

export function postalOptions(s: AppSettings): PostalOptions {
  return { format: s.postalFormat, spaces: s.postalSpaces };
}
