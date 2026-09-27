// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Achievements are the website's alone (`src/app/achievementsBuilt.ts`). The
// build flags are compile-time constants in a real build; here they are globals
// the test sets before importing the modules afresh, which is how Vitest
// resolves a bare `__NAME__` without a `define`. The bundle itself is checked
// by `native/scripts/bundle-web.mjs`, which refuses a webroot that carries them.

import { afterEach, describe, expect, it, vi } from "vitest";

type Flags = { native: boolean; shell: boolean };

async function load(flags: Flags) {
  vi.stubGlobal("__NATIVE_BUILD__", flags.native);
  vi.stubGlobal("__SHELL_BUILD__", flags.shell);
  vi.resetModules();
  const { ACHIEVEMENTS_BUILT } =
    await import("../src/app/achievementsBuilt.ts");
  const { svCatalog } = await import("../src/app/i18n/svCatalog.ts");
  return { ACHIEVEMENTS_BUILT, svCatalog };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ACHIEVEMENTS_BUILT", () => {
  it("is on for the website, with the copy joined onto the catalog", async () => {
    const { ACHIEVEMENTS_BUILT, svCatalog } = await load({
      native: false,
      shell: false,
    });
    expect(ACHIEVEMENTS_BUILT).toBe(true);
    expect(svCatalog.achievements.modal.title.length).toBeGreaterThan(0);
  });

  it("is off for the phone app, and the copy stays out", async () => {
    const { ACHIEVEMENTS_BUILT, svCatalog } = await load({
      native: true,
      shell: false,
    });
    expect(ACHIEVEMENTS_BUILT).toBe(false);
    expect("achievements" in svCatalog).toBe(false);
  });

  it("is off for the desktop app too", async () => {
    const { ACHIEVEMENTS_BUILT, svCatalog } = await load({
      native: false,
      shell: true,
    });
    expect(ACHIEVEMENTS_BUILT).toBe(false);
    expect("achievements" in svCatalog).toBe(false);
  });
});
