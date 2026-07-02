// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import { useLocalStorageState } from "./useLocalStorageState.ts";

// The app's own (non-theme) settings — how the side menu opens, achievements,
// developer mode, log capture. The framework deliberately leaves this in the
// app; it only owns the appearance projection. (The active *language* is owned
// by the framework i18n runtime — see `i18n/index.ts`.) Persisted to
// localStorage so a reload keeps your choices.

export type MenuMode = "swipe" | "button";

export type AppSettings = {
  menuMode: MenuMode;
  disableAchievements: boolean;
  devMode: boolean;
  captureLogs: boolean;
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
};

const STORAGE_KEY = "contacts:settings";

export function useAppSettings() {
  // The framework hook owns the persistence mechanics (safe parse, merging a
  // stored partial over the defaults, write-through); this store owns the
  // key and the settings shape.
  const [settings, setSettings] = useLocalStorageState<AppSettings>(
    STORAGE_KEY,
    DEFAULT_SETTINGS,
  );

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [setSettings],
  );

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [setSettings]);

  return { settings, update, reset, setSettings };
}
