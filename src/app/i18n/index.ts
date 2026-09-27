// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's i18n runtime, built once from the framework's `createI18n`
// factory over the app's own catalogs. English is bundled; Swedish is
// code-split and loaded on demand. The app owns the strings (these catalogs);
// the framework owns the machinery that loads, caches, resolves, and
// re-renders against them — including the preference mirror and the
// first-paint gate `LanguageRoot` provides.

import { createI18n } from "@niclaslindstedt/oss-framework/i18n";

import { ACHIEVEMENTS_BUILT } from "../achievementsBuilt.ts";
import { en, type Catalog as BaseCatalog } from "./en.ts";
import { enAchievements, type AchievementsCopy } from "./enAchievements.ts";

export type Lang = "en" | "sv";

/** Every string the app can ask for: the base catalog, plus the achievements
 *  copy under `achievements.*`. That copy is joined on only in a build that
 *  carries achievements (`../achievementsBuilt.ts`) — the phone and desktop
 *  builds never ask for it, so their bundles leave it out. */
export type Catalog = BaseCatalog & { achievements: AchievementsCopy };

export const i18n = createI18n<Lang, Catalog>({
  fallbackLang: "en",
  fallbackCatalog: (ACHIEVEMENTS_BUILT
    ? { ...en, achievements: enAchievements }
    : en) as Catalog,
  loaders: {
    // The Swedish chunk joins its achievements copy on itself
    // (`./svCatalog.ts`), so a build without achievements leaves it out of
    // that chunk too.
    sv: () => import("./svCatalog.ts").then((m) => m.svCatalog),
  },
  // Two-letter codes → concrete BCP-47 tags for `<html lang>` / Intl.
  toBcp47: (lang) => (lang === "sv" ? "sv-SE" : "en-GB"),
  storageKey: "contacts:language",
  eventName: "contacts:language",
});

export const { LanguageRoot, useT, useLang, setLanguage, supportedLangs } =
  i18n;

/** The translate function `useT()` returns — a message key (optionally with
 *  interpolation params) to a resolved string. Handy where the catalog is
 *  composed outside a component (e.g. `buildCatalog` in `achievements.ts`). */
export type TFn = ReturnType<typeof useT>;
