// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The phone app offers neither Dropbox nor a local folder
// (`src/app/dropboxBuilt.ts`); the website and the desktop app keep both. The
// build flags are compile-time constants in a real build; here they are
// globals the test sets before importing the modules afresh, which is how
// Vitest resolves a bare `__NAME__` without a `define`. The last cases build
// the phone app and the website for real and read what they wrote. The phone
// app carries no What's new to name it in (`changelogBuilt_test.ts`).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const root = join(__dirname, "..");

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

  it("keeps a remembered local folder on the website", async () => {
    const m = await load(
      { native: false, shell: false },
      { "contacts:sync:backend": "folder" },
    );
    expect(m.readBackend()).toBe("folder");
  });

  it("opens a phone install that remembers a local folder on this device", async () => {
    const m = await load(
      { native: true, shell: true },
      { "contacts:sync:backend": "folder" },
    );
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

// Builds the app for real with the flags the build scripts set and reports
// whether any emitted file carries `needle`. NODE_ENV and the test runner's own
// variables are dropped, so it is the build CI ships.
function buildCarries(env: Record<string, string>, needle: string): boolean {
  const out = mkdtempSync(join(tmpdir(), "dropbox-built-"));
  try {
    const base = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          key !== "NODE_ENV" &&
          !key.startsWith("VITEST") &&
          !key.startsWith("VITE_"),
      ),
    );
    execFileSync(
      process.execPath,
      [
        join(root, "node_modules", "vite", "bin", "vite.js"),
        "build",
        "--outDir",
        out,
        "--emptyOutDir",
        "--logLevel",
        "error",
      ],
      { cwd: root, env: { ...base, ...env }, stdio: "pipe" },
    );
    return readdirSync(out, { recursive: true, withFileTypes: true }).some(
      (entry) =>
        entry.isFile() &&
        readFileSync(join(entry.parentPath, entry.name)).includes(needle),
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

// The folder flow's own log lines stand for its code: present, the picker and
// the reconnect path rode along; gone, the minifier dropped them.
const FOLDER_FLOW = [
  "folder: opening the directory picker",
  "folder: reconnected",
];

describe("the real builds", () => {
  it("leave the local-folder flow out of the phone app", () => {
    for (const needle of FOLDER_FLOW) {
      expect(
        buildCarries(
          { VITE_NATIVE_BUILD: "on", VITE_SHELL_BUILD: "on" },
          needle,
        ),
      ).toBe(false);
    }
  }, 120_000);

  it("keep it in the website", () => {
    for (const needle of FOLDER_FLOW) {
      expect(buildCarries({}, needle)).toBe(true);
    }
  }, 120_000);
});
