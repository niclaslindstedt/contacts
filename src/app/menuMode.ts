// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Whether the side menu opens with an inward edge swipe in place of the
// floating button (Settings → General → "Open sidebar with").
//
// The choice exists only where the screen edge is free: an installed PWA on a
// phone or tablet, or the phone app's native shell — both are what the
// framework's `useStandaloneMobile()` / `isStandaloneMobile()` answer true for.
// A browser tab keeps its edge for the browser's own back-swipe, and a mouse
// cannot swipe at all, so there the setting is not offered and a stored
// "swipe" falls back to the button rather than leaving no way into the menu.
// A docked sidebar (`pinned`) needs neither.

import type { MenuMode } from "./useAppSettings.ts";

export function swipeOpensMenu(
  mode: MenuMode,
  { pinned, standalone }: { pinned: boolean; standalone: boolean },
): boolean {
  return !pinned && standalone && mode === "swipe";
}
