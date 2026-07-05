// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";
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

/** How large the List view draws each contact row. `spacious` blows the photo
 *  up so it's easy to see; `compact` keeps rows dense so more fit on screen. */
export type ListDensity = "compact" | "spacious";

/** Which phone number(s) the List view prefers under each name: the contact's
 *  private one, their work one, or both. When the preferred kind is absent the
 *  view falls back to whatever the contact has — a glance is meant to be handy,
 *  not exact, and the card is one tap away. */
export type ListPhonePriority = "private" | "work" | "both";

/** How the folders are ordered wherever they group contacts (the side menu and
 *  the overview List). `alphabetical` sorts them by name; `manual` keeps the
 *  hand-dragged order — dragging one folder onto another reorders the list.
 *  Either way folders come before the ungrouped contacts. */
export type FolderSort = "alphabetical" | "manual";

/** How far the page behind an open dialog is dimmed. `none` leaves it in full
 *  view; the rest fade it toward black in increasing steps. */
export type BackdropDarkness = "none" | "subtle" | "medium" | "dark";

/** How far the page behind an open dialog is blurred. `none` keeps it crisp
 *  (the default); the rest soften it in increasing steps. */
export type BackdropBlur = "none" | "subtle" | "medium" | "strong";

/** The black-alpha each darkness step dims the modal backdrop to. `medium`
 *  matches the framework's original `bg-black/50` scrim. */
export const BACKDROP_DARKNESS: Record<BackdropDarkness, number> = {
  none: 0,
  subtle: 0.35,
  medium: 0.5,
  dark: 0.75,
};

/** The blur radius (px) each step applies behind an open dialog. */
export const BACKDROP_BLUR_PX: Record<BackdropBlur, number> = {
  none: 0,
  subtle: 2,
  medium: 4,
  strong: 8,
};

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
  /** Show each contact's phone numbers under their name in the list view. */
  listShowPhone: boolean;
  /** Show each contact's email addresses under their name in the list view. */
  listShowEmail: boolean;
  /** How large each contact row is in the list view (bigger photos when
   *  spacious). */
  listDensity: ListDensity;
  /** Which phone number(s) the list view prefers under each name. */
  listPhonePriority: ListPhonePriority;
  /** How folders are ordered in the side menu and the List — alphabetically,
   *  or in the hand-dragged order. */
  folderSort: FolderSort;
  /** How far the page behind an open dialog is dimmed. */
  modalBackdropDarkness: BackdropDarkness;
  /** How far the page behind an open dialog is blurred. */
  modalBackdropBlur: BackdropBlur;
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
  // Dates default to ISO; phone/postal formatting defaults *on*, so phones and
  // postal codes render in the home country's convention out of the box. The
  // Format tab can switch either back off to show values exactly as typed.
  dateFormat: "iso",
  country: DEFAULT_COUNTRY,
  phoneFormat: true,
  phoneCountryCode: true,
  phoneLeadingZero: true,
  postalFormat: true,
  postalSpaces: true,
  // The list view shows phone numbers under each name by default (the most
  // useful thing to glance at); email is opt-in so the rows stay compact.
  listShowPhone: true,
  listShowEmail: false,
  // Dense by default so the overview fits as many contacts as possible; the
  // spacious option trades that for a bigger, easier-to-see photo.
  listDensity: "compact",
  // Show every number by default; the user can narrow the list to just private
  // or just work numbers to keep rows tidy.
  listPhonePriority: "both",
  // Folders sort alphabetically out of the box — the least-surprising order for
  // a fresh address book; switching to manual unlocks drag-to-reorder.
  folderSort: "alphabetical",
  // The dialog backdrop dims the page to 50% black (the framework's original
  // look) and adds no blur out of the box — both are tunable in Appearance.
  modalBackdropDarkness: "medium",
  modalBackdropBlur: "none",
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

// --- Settings → modal backdrop projection ------------------------------------
// The dialog backdrop's darkness and blur are app-owned look knobs (the
// framework's `ThemeAppearance` doesn't model them). Project them onto `<html>`
// as CSS variables the scrim rule in `styles.css` consumes — mirroring how the
// framework's theme engine writes its own UI-style variables. Called from the
// app root for the persisted settings, and live from the Appearance tab so the
// open dialog previews the change against itself.
export function applyBackdropVars(
  s: AppSettings,
  el: HTMLElement = document.documentElement,
): void {
  el.style.setProperty(
    "--modal-backdrop-darkness",
    String(BACKDROP_DARKNESS[s.modalBackdropDarkness]),
  );
  el.style.setProperty(
    "--modal-backdrop-blur",
    `${BACKDROP_BLUR_PX[s.modalBackdropBlur]}px`,
  );
}
