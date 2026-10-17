// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The phone app offers no Dropbox (`src/app/dropboxBuilt.ts`); the website and
// the desktop app keep it. The build flags are compile-time constants in a
// real build; here they are globals the test sets before importing the
// modules afresh, which is how Vitest resolves a bare `__NAME__` without a
// `define`. The markdown What's new renders is checked through the same
// `withoutDropbox` that `vite.config.ts` loads it with in the phone build.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { withoutDropbox } from "../src/app/withoutDropbox.ts";

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

describe("withoutDropbox", () => {
  it("drops a list item, a paragraph and a section that name Dropbox", () => {
    const md = [
      "# Sync",
      "",
      "Connect a backend:",
      "",
      "- **Dropbox** — OAuth, with",
      "  a continuation line.",
      "- **iCloud Drive** — on the phone.",
      "",
      "Dropbox works here too.",
      "",
      "Photos are filed out.",
      "",
      "## The atlas on Dropbox",
      "",
      "Packs of avatars.",
      "",
      "### Deeper",
      "",
      "Still the atlas.",
      "",
      "## Self-healing",
      "",
      "Names repair themselves.",
    ].join("\n");
    expect(withoutDropbox(md)).toBe(
      [
        "# Sync",
        "",
        "Connect a backend:",
        "",
        "- **iCloud Drive** — on the phone.",
        "",
        "",
        "Photos are filed out.",
        "",
        "## Self-healing",
        "",
        "Names repair themselves.",
      ].join("\n"),
    );
  });

  it("drops a heading the cut emptied, and keeps one that was empty already", () => {
    const md = [
      "## [Unreleased]",
      "",
      "## [1.0.0]",
      "",
      "### Added",
      "",
      "- Dropbox in the desktop app.",
      "",
      "### Fixed",
      "",
      "- A crash on open.",
    ].join("\n");
    const out = withoutDropbox(md);
    expect(out).toContain("## [Unreleased]");
    expect(out).toContain("## [1.0.0]");
    expect(out).not.toContain("### Added");
    expect(out).toContain("### Fixed\n\n- A crash on open.");
  });

  it("leaves the phone's What's new without a word about Dropbox", () => {
    const root = join(__dirname, "..");
    const features = join(root, "docs", "features");
    const unreleased = join(root, ".changes", "unreleased");
    const texts = [
      readFileSync(join(root, "CHANGELOG.md"), "utf8"),
      ...readdirSync(features).map((f) =>
        readFileSync(join(features, f), "utf8"),
      ),
      ...readdirSync(unreleased).map((f) =>
        readFileSync(join(unreleased, f), "utf8"),
      ),
    ];
    for (const text of texts) {
      expect(withoutDropbox(text)).not.toMatch(/dropbox/i);
    }
    const cloudSync = withoutDropbox(
      readFileSync(join(features, "cloud-sync.md"), "utf8"),
    );
    expect(cloudSync).toContain("**iCloud Drive**");
  });
});
