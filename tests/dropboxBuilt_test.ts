// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The phone app offers no Dropbox (`src/app/dropboxBuilt.ts`); the website and
// the desktop app keep it. The build flags are compile-time constants in a
// real build; here they are globals the test sets before importing the
// modules afresh, which is how Vitest resolves a bare `__NAME__` without a
// `define`. The phone app carries no What's new to name it in
// (`changelogBuilt_test.ts`).

import { afterEach, describe, expect, it, vi } from "vitest";

type Flags = { native: boolean; shell: boolean };

/** A localStorage holding `entries`, enough for the engine's readers. */
function memoryStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

async function load(flags: Flags, stored: Record<string, string> = {}) {
  vi.stubGlobal("__NATIVE_BUILD__", flags.native);
  vi.stubGlobal("__SHELL_BUILD__", flags.shell);
  vi.stubGlobal("localStorage", memoryStorage(stored));
  vi.stubEnv("VITE_DROPBOX_APP_KEY", "app-key");
  vi.resetModules();
  const { DROPBOX_BUILT } = await import("../src/app/dropboxBuilt.ts");
  const { DROPBOX_APP_KEY, readBackend } =
    await import("../src/app/useSyncEngine.ts");
  return { DROPBOX_BUILT, DROPBOX_APP_KEY, readBackend };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("DROPBOX_BUILT", () => {
  it("is on for the website, with the key the build was given", async () => {
    const m = await load({ native: false, shell: false });
    expect(m.DROPBOX_BUILT).toBe(true);
    expect(m.DROPBOX_APP_KEY).toBe("app-key");
  });

  it("is on for the desktop app too", async () => {
    const m = await load({ native: false, shell: true });
    expect(m.DROPBOX_BUILT).toBe(true);
    expect(m.DROPBOX_APP_KEY).toBe("app-key");
  });

  it("is off for the phone app, which has no key whatever the environment says", async () => {
    const m = await load({ native: true, shell: true });
    expect(m.DROPBOX_BUILT).toBe(false);
    expect(m.DROPBOX_APP_KEY).toBe("");
  });
});

describe("readBackend", () => {
  const STORED = { "contacts:sync:backend": "dropbox" };

  it("keeps a remembered Dropbox on the website", async () => {
    const m = await load({ native: false, shell: false }, STORED);
    expect(m.readBackend()).toBe("dropbox");
  });

  it("opens a phone install that remembers Dropbox on this device", async () => {
    const m = await load({ native: true, shell: true }, STORED);
    expect(m.readBackend()).toBe("local");
  });

  it("keeps iCloud Drive on the phone", async () => {
    const m = await load(
      { native: true, shell: true },
      { "contacts:sync:backend": "icloud" },
    );
    expect(m.readBackend()).toBe("icloud");
  });
});
