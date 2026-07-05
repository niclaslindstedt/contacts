// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { deriveUnlocks } from "@niclaslindstedt/oss-framework/achievements";

import { SPECS, buildCatalog, type AchState } from "../src/app/achievements.ts";
import type { Contact, Folder } from "../src/app/types.ts";

// A stub translate: `buildCatalog` only reads strings for display, and the
// unlock derivation the framework runs never touches them — so returning the
// key keeps the catalog structurally real without pulling in i18n. The i18n
// shape is covered separately in `achievements_i18n_test.ts`.
const t = ((key: string) => key) as unknown as Parameters<
  typeof buildCatalog
>[0];
const catalog = buildCatalog(t);

function card(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
    ...overrides,
  };
}

function doc(overrides: Partial<AchState> = {}): AchState {
  return {
    folders: [],
    contacts: [],
    activeContactId: "",
    ...overrides,
  };
}

// A base document that already holds one named contact, so `firstContact` is
// true in both `prev` and `next` and never re-fires — each case can then flip a
// single feature on and assert only that trophy derives.
const base = doc({ contacts: [card()] });

// Derive the ids unlocked crossing from `base` to a document with `next`
// applied to its single contact (or extra top-level fields).
function unlockedAfter(next: Partial<AchState>): string[] {
  return deriveUnlocks(catalog, base, doc({ contacts: [card()], ...next }), {});
}
function unlockedAfterContact(patch: Partial<Contact>): string[] {
  return deriveUnlocks(catalog, base, doc({ contacts: [card(patch)] }), {});
}

describe("derived achievement triggers", () => {
  it("wellConnected fires when a contact gains a phone and an email", () => {
    expect(
      unlockedAfterContact({
        phones: [{ id: "p1", value: "555" }],
        emails: [{ id: "e1", value: "a@b.c" }],
      }),
    ).toContain("wellConnected");
  });

  it("birthday fires when a contact gains a birthday", () => {
    expect(unlockedAfterContact({ birthday: "1990-05-01" })).toContain(
      "birthday",
    );
  });

  it("importantDate fires on the first extra important date", () => {
    expect(
      unlockedAfterContact({
        importantDates: [{ id: "d1", label: "Name day", date: "05-01" }],
      }),
    ).toContain("importantDate");
  });

  it("address fires when a contact gains a postal address part", () => {
    expect(
      unlockedAfterContact({
        addresses: [{ id: "a1", city: "London" }],
      }),
    ).toContain("address");
  });

  it("favorite fires when a contact is starred", () => {
    expect(unlockedAfterContact({ favorite: true })).toContain("favorite");
  });

  it("emergency fires when a contact is flagged ICE", () => {
    expect(unlockedAfterContact({ ice: true })).toContain("emergency");
  });

  it("company fires when a card becomes a company", () => {
    expect(unlockedAfterContact({ isCompany: true })).toContain("company");
  });

  it("archivist fires when a contact is archived", () => {
    expect(unlockedAfterContact({ archived: true })).toContain("archivist");
  });

  it("autoArchive fires when a contact is set to self-archive", () => {
    expect(unlockedAfterContact({ autoArchiveDate: "2030-01-01" })).toContain(
      "autoArchive",
    );
  });

  it("attachment fires when a file is clipped to a contact", () => {
    expect(
      unlockedAfterContact({
        attachments: [{ id: "f1", name: "menu.pdf", mime: "application/pdf" }],
      }),
    ).toContain("attachment");
  });

  it("photogenic fires on a first photo, gallery only on a second", () => {
    const one = unlockedAfterContact({
      photos: [{ id: "ph1", photo: "data:x" }],
    });
    expect(one).toContain("photogenic");
    expect(one).not.toContain("gallery");

    const two = unlockedAfterContact({
      photos: [
        { id: "ph1", photo: "data:x" },
        { id: "ph2", photo: "data:y" },
      ],
    });
    expect(two).toContain("gallery");
  });

  it("madeItYours fires when a contact gains a glyph or colour", () => {
    expect(unlockedAfterContact({ glyph: "building" })).toContain(
      "madeItYours",
    );
  });

  it("subfolder fires when a folder nests inside another", () => {
    const folders: Folder[] = [
      { id: "f1", name: "Family" },
      { id: "f2", name: "Cousins", parentId: "f1" },
    ];
    expect(unlockedAfter({ folders })).toContain("subfolder");
  });

  it("a folder whose parent does not exist does not count as a subfolder", () => {
    const folders: Folder[] = [{ id: "f2", name: "Orphan", parentId: "gone" }];
    expect(unlockedAfter({ folders })).not.toContain("subfolder");
  });

  it("collector fires only at five named contacts", () => {
    const five = Array.from({ length: 5 }, (_, i) =>
      card({ id: `c${i}`, firstName: `P${i}`, lastName: "Q" }),
    );
    expect(deriveUnlocks(catalog, base, doc({ contacts: five }), {})).toContain(
      "collector",
    );
  });
});

describe("manual achievement triggers", () => {
  const manualIds = SPECS.filter((s) => s.trigger.kind === "manual").map(
    (s) => s.id,
  );

  it("cover the sync, backup, namespace, export/import, search, and undo gestures", () => {
    for (const id of [
      "seeker",
      "namespaces",
      "synced",
      "backup",
      "timeTraveler",
      "exporter",
      "importer",
      "encryption",
    ]) {
      expect(manualIds).toContain(id);
    }
  });

  it("never derive from a document change (they ride the manual bus)", () => {
    const everything = unlockedAfterContact({
      phones: [{ id: "p1", value: "555" }],
      emails: [{ id: "e1", value: "a@b.c" }],
      favorite: true,
      ice: true,
    });
    for (const id of manualIds) expect(everything).not.toContain(id);
  });
});

describe("catalog structure", () => {
  it("has unique, stable ids", () => {
    const ids = SPECS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("assigns every entry a known tier and a glyph", () => {
    const tiers = new Set(["beginner", "intermediate", "pro", "expert"]);
    for (const s of SPECS) {
      expect(tiers.has(s.tier)).toBe(true);
      expect(typeof s.glyph).toBe("function");
    }
  });

  it("gives every built entry a name and condition, and a learnMore only where declared", () => {
    for (const s of SPECS) {
      const entry = catalog.find((c) => c.id === s.id);
      expect(entry).toBeDefined();
      expect(entry!.name).toBeTruthy();
      expect(entry!.condition).toBeTruthy();
      if (s.hasLearnMore) expect(entry!.learnMore).toBeTruthy();
      else expect(entry!.learnMore).toBeUndefined();
    }
  });
});
