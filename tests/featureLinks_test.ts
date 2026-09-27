// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A What's new bullet never offers a Learn more that opens nothing: a link
// to a feature doc the build leaves out (the achievements page in the phone
// and desktop apps) is dropped, and the bullet kept.

import { describe, expect, it } from "vitest";

import { withoutMissingFeatureLinks } from "../src/app/featureLinks.ts";

const md = [
  "- **A trophy for every feature** — Fifteen new achievements join the tour. [Learn more](feature:achievements)",
  "- **Undo archive & delete** — Archiving raises an Undo toast. [Learn more](feature:list)",
  "- **Quick find** — Type to find a contact by name or",
  "  relationship. [Learn more](feature:quick-find)",
].join("\n");

describe("withoutMissingFeatureLinks", () => {
  it("drops the link to a doc the build leaves out, keeping the bullet", () => {
    const out = withoutMissingFeatureLinks(md, { list: {}, "quick-find": {} });
    expect(out).not.toContain("feature:achievements");
    expect(out).toContain(
      "- **A trophy for every feature** — Fifteen new achievements join the tour.\n",
    );
  });

  it("keeps every link whose doc is there", () => {
    const out = withoutMissingFeatureLinks(md, { list: {}, "quick-find": {} });
    expect(out).toContain("toast. [Learn more](feature:list)");
    expect(out).toContain("relationship. [Learn more](feature:quick-find)");
  });

  it("changes nothing when the build carries every doc", () => {
    expect(
      withoutMissingFeatureLinks(md, {
        achievements: {},
        list: {},
        "quick-find": {},
      }),
    ).toBe(md);
  });

  it("does not take a doc from the object's prototype", () => {
    expect(
      withoutMissingFeatureLinks("Hi. [Learn more](feature:toString)", {}),
    ).toBe("Hi.");
  });
});
