// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { buildServiceWorker } from "../pwa-plugin.ts";
import { cacheIdForBase } from "../src/app/pwa.ts";

// The three release channels share one Pages origin, so their service workers
// must not collide: each needs its own precache cache id, and the root worker —
// whose scope is a prefix of the sibling channels — must disown their paths.

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
