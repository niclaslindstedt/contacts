// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { buildManifest, buildServiceWorker } from "../pwa-plugin.ts";
import { cacheIdForBase } from "../src/app/pwa.ts";

// The three release channels share one Pages origin, so their service workers
// must not collide: each needs its own precache cache id, and the root worker —
// whose scope is a prefix of the sibling channels — must disown their paths.

describe("buildManifest identity", () => {
  const parse = (base: string) =>
    JSON.parse(buildManifest(base)) as Record<string, unknown>;

  it("pins id/start_url/scope to the absolute base per channel", () => {
    // These members resolve relative to the *origin* (not the manifest URL) in
    // some engines — iOS Safari's Add to Home Screen among them — so a relative
    // "./" collapses every channel onto the root app. Absolute base paths give
    // each channel a distinct, unambiguous install identity.
    for (const base of ["/", "/preview/", "/branch/"]) {
      const m = parse(base);
      expect(m.id).toBe(base);
      expect(m.start_url).toBe(base);
      expect(m.scope).toBe(base);
    }
  });

  it("gives each channel a distinct identity and tile name", () => {
    const bases = ["/", "/preview/", "/branch/"];
    const ids = bases.map((b) => parse(b).id);
    const names = bases.map((b) => parse(b).name);
    expect(new Set(ids).size).toBe(bases.length);
    // Distinct names so the installed tiles are told apart on the home screen.
    expect(new Set(names).size).toBe(bases.length);
    expect(parse("/preview/").name).toContain("preview");
    expect(parse("/branch/").name).toContain("branch");
  });

  it("base-qualifies icon srcs so they resolve per channel", () => {
    const icons = parse("/preview/").icons as { src: string }[];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons)
      expect(icon.src.startsWith("/preview/")).toBe(true);
  });
});

describe("cacheIdForBase", () => {
  it("derives a distinct cache id per channel base", () => {
    const ids = [
      cacheIdForBase("/"), // release (custom-domain root)
      cacheIdForBase("/preview/"), // main
      cacheIdForBase("/branch/my-feature/"), // feature branch
    ];
    // All three coexist on one origin — the ids must be pairwise distinct so a
    // channel's activate step never evicts a sibling's precache.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses the bare id for the root release", () => {
    expect(cacheIdForBase("/")).toBe("contacts");
  });
});

describe("buildServiceWorker ignorePaths", () => {
  const root = buildServiceWorker(
    cacheIdForBase("/"),
    "/",
    "abc1234",
    ["/index.html"],
    ["/preview/", "/branch/"],
  );

  it("embeds the disowned sibling paths", () => {
    expect(root).toContain('const IGNORE = ["/preview/","/branch/"]');
  });

  it("disowns navigations that fall under a sibling channel", () => {
    // The generated worker steps aside for ignored paths before serving the
    // shell fallback.
    expect(root).toContain(
      "if (IGNORE.some((p) => url.pathname.startsWith(p))) return;",
    );
  });

  it("defaults to claiming nothing extra when no siblings are nested", () => {
    const preview = buildServiceWorker(
      cacheIdForBase("/preview/"),
      "/preview/",
      "abc1234",
      ["/preview/index.html"],
    );
    expect(preview).toContain("const IGNORE = []");
  });
});
