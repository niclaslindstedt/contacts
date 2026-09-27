// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The two entry points the rest of the app reaches achievements through —
// the website's alone.
//
// In the phone and desktop builds `ACHIEVEMENTS_BUILT` (`./achievementsBuilt.ts`)
// is a literal `false`: `unlock` is a no-op, `useAchievementsLayer` hands back
// nothing, and the framework's trophy UI, the app's catalog and its copy
// (`./i18n/enAchievements.ts`) are dropped from the bundle rather than hidden.
// Settings → General's "Disable achievements" is a per-device preference on the
// website only; this is the build's answer.
//
// Every `unlock(…)` in the app comes from here, never from the framework
// directly, so a native build carries no trophy bus to feed.

import { unlock as busUnlock } from "@niclaslindstedt/oss-framework/achievements";

import { ACHIEVEMENTS_BUILT } from "./achievementsBuilt.ts";
import {
  NO_ACHIEVEMENTS,
  useAchievementsLayer as useWebsiteAchievements,
  type AchievementsLayer,
} from "./useAchievementsLayer.tsx";

export { ACHIEVEMENTS_BUILT };

/** Fire a manual trophy — the framework's bus on the website, nothing
 *  elsewhere. */
export const unlock: (id: string) => void = ACHIEVEMENTS_BUILT
  ? busUnlock
  : () => {};

function useNoAchievements(): AchievementsLayer {
  return NO_ACHIEVEMENTS;
}

/** The app's achievements wiring (the ledger, the watcher, the trophy row and
 *  the two modals) — or an empty layer in a build without achievements.
 *  Chosen once at build time, so it is always the same hook for a given
 *  bundle. */
export const useAchievementsLayer: typeof useWebsiteAchievements =
  ACHIEVEMENTS_BUILT ? useWebsiteAchievements : useNoAchievements;
