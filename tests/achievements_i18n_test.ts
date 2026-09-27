// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { enAchievements } from "../src/app/i18n/enAchievements.ts";
import { svAchievements } from "../src/app/i18n/svAchievements.ts";
import { SPECS } from "../src/app/achievements.ts";

// The achievement copy is fully translated: English is the source of the
// `AchievementsCopy` type and Swedish must mirror it key-for-key. The two
// files — apart from the main catalogs, because only the website carries them
// — are checked together so a missing or empty Swedish leaf fails here rather
// than shipping an untranslated trophy.

type Tree = Record<string, unknown>;

// Collect every leaf path under an object, so two catalogs can be compared for
// an identical key structure.
function leafPaths(obj: Tree, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? leafPaths(v as Tree, path) : [path];
  });
}

const enAch = enAchievements as unknown as Tree;
const svAch = svAchievements as unknown as Tree;

describe("achievements i18n parity", () => {
  it("Swedish mirrors English key-for-key under achievements", () => {
    expect(leafPaths(svAch).sort()).toEqual(leafPaths(enAch).sort());
  });

  it("has no empty English or Swedish leaves", () => {
    for (const tree of [enAch, svAch]) {
      for (const path of leafPaths(tree)) {
        const value = path
          .split(".")
          .reduce<unknown>((acc, k) => (acc as Tree)[k], tree);
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("carries a name and condition for every catalog id, in both locales", () => {
    for (const { id } of SPECS) {
      for (const cat of [enAchievements.catalog, svAchievements.catalog]) {
        const entry = (
          cat as Record<string, { name: string; condition: string }>
        )[id];
        expect(entry, `missing catalog entry ${id}`).toBeDefined();
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.condition.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("carries a learnMore exactly where the spec declares one", () => {
    for (const spec of SPECS) {
      for (const cat of [enAchievements.catalog, svAchievements.catalog]) {
        const entry = (cat as Record<string, { learnMore?: string }>)[spec.id];
        if (spec.hasLearnMore) {
          expect(
            entry.learnMore?.trim().length,
            `${spec.id} should have learnMore`,
          ).toBeGreaterThan(0);
        } else {
          expect(
            entry.learnMore,
            `${spec.id} should not have learnMore`,
          ).toBeUndefined();
        }
      }
    }
  });

  it("has no catalog copy for an id that no longer exists", () => {
    const ids = new Set(SPECS.map((s) => s.id));
    for (const key of Object.keys(enAchievements.catalog)) {
      expect(ids.has(key), `orphan catalog copy: ${key}`).toBe(true);
    }
  });
});
