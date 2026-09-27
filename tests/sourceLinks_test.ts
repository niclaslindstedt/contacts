// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Links back to the source are the website's alone (`src/app/sourceLinks.ts`).
// The build flags are compile-time constants in a real build; here they are
// globals the test sets before importing the module afresh, which is how
// Vitest resolves a bare `__NAME__` without a `define`. The bundle itself is
// checked by `scripts/website-only.mjs`, which the phone and desktop bundle
// scripts run over the webroot.

import { afterEach, describe, expect, it, vi } from "vitest";

type Flags = { native: boolean; shell: boolean };

async function load(flags: Flags) {
  vi.stubGlobal("__NATIVE_BUILD__", flags.native);
  vi.stubGlobal("__SHELL_BUILD__", flags.shell);
  vi.resetModules();
  return import("../src/app/sourceLinks.ts");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SOURCE_URL", () => {
  it("links the website to the repository", async () => {
    const m = await load({ native: false, shell: false });
    expect(m.SOURCE_LINKS_BUILT).toBe(true);
    expect(m.SOURCE_URL).toBe("https://github.com/niclaslindstedt/contacts");
  });

  it("gives the phone app no link back to the source", async () => {
    const m = await load({ native: true, shell: false });
    expect(m.SOURCE_LINKS_BUILT).toBe(false);
    expect(m.SOURCE_URL).toBeNull();
  });

  it("gives the desktop app none either", async () => {
    const m = await load({ native: false, shell: true });
    expect(m.SOURCE_LINKS_BUILT).toBe(false);
    expect(m.SOURCE_URL).toBeNull();
  });
});

describe("withoutSourceLinks", () => {
  // Build-time only (`vite.config.ts` applies it to every `.md?raw` module in
  // the phone and desktop builds), so no flags to set.
  const load = () => import("../src/app/withoutSourceLinks.ts");

  it("keeps a source link's words and drops its target", async () => {
    const { withoutSourceLinks } = await load();
    expect(
      withoutSourceLinks(
        "attached to every release on the\n[releases page](https://github.com/niclaslindstedt/contacts/releases).",
      ),
    ).toBe("attached to every release on the\nreleases page.");
  });

  it("drops a list item that names the domain, continuation lines with it", async () => {
    const { withoutSourceLinks } = await load();
    const md = [
      "### Changed",
      "",
      "- **New home** — The app now lives at",
      "  contacts.niclaslindstedt.se.",
      "- **Quick find** — Type to find a contact. [Learn more](feature:quick-find)",
    ].join("\n");
    expect(withoutSourceLinks(md)).toBe(
      [
        "### Changed",
        "",
        "- **Quick find** — Type to find a contact. [Learn more](feature:quick-find)",
      ].join("\n"),
    );
  });

  it("leaves text without the owner's name alone", async () => {
    const { withoutSourceLinks } = await load();
    const md = "- **Paste** — [Learn more](feature:paste-to-create)\n\nText.";
    expect(withoutSourceLinks(md)).toBe(md);
  });
});
