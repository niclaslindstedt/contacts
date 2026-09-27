// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Whether this build carries achievements at all: only the website does.
//
// The phone app (`__NATIVE_BUILD__`) and the desktop app (`__SHELL_BUILD__`)
// ship without achievements, trophies or unlock celebrations, and without the
// Settings switch that turns them off. Both flags are compile-time constants
// Vite substitutes, so in those builds this is a literal `false` and every
// branch it guards is dropped from the bundle rather than hidden. It sits in a
// module of its own so the i18n runtime can read it without pulling in the
// achievements wiring (`./achievementsGate.ts`).
export const ACHIEVEMENTS_BUILT: boolean = !(
  __NATIVE_BUILD__ || __SHELL_BUILD__
);
