// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  LARGE_SEED_COUNT,
  buildFakeData,
  parseSeedEnv,
} from "../src/app/dev/fakeData.ts";
import { createSeedBackend } from "../src/app/dev/seedBackend.ts";
import { displayName } from "../src/app/types.ts";

describe("parseSeedEnv", () => {
  it("treats absent / falsy values as inactive", () => {
    for (const raw of [undefined, null, "", "0", "false", "off", "no", "  "]) {
      expect(parseSeedEnv(raw)).toEqual({ active: false, size: "sample" });
    }
  });

  it("treats plain truthy tokens as the curated sample", () => {
    for (const raw of ["1", "true", "on", "yes", "sample", "SAMPLE", "wat"]) {
      expect(parseSeedEnv(raw)).toEqual({ active: true, size: "sample" });
    }
  });

  it("expands the large / stress aliases to the stress count", () => {
    for (const raw of ["large", "LARGE", "xl", "stress", "max"]) {
      expect(parseSeedEnv(raw)).toEqual({
        active: true,
        size: LARGE_SEED_COUNT,
      });
    }
  });

  it("reads a number as an explicit contact count", () => {
    expect(parseSeedEnv("250")).toEqual({ active: true, size: 250 });
    expect(parseSeedEnv("42")).toEqual({ active: true, size: 42 });
    // A bare "1" is the sample, not a one-contact count.
    expect(parseSeedEnv("1")).toEqual({ active: true, size: "sample" });
    // Fractions floor to whole cards.
    expect(parseSeedEnv("9.9")).toEqual({ active: true, size: 9 });
  });
});

describe("buildFakeData", () => {
  it("returns a fresh, deterministic document each call", () => {
    const a = buildFakeData();
    const b = buildFakeData();
    // Same content…
    expect(a).toEqual(b);
    // …but not the same object (edits must not mutate the template).
    expect(a).not.toBe(b);
    expect(a.contacts).not.toBe(b.contacts);
  });

  it("opens on a contact that exists in the document", () => {
    const doc = buildFakeData();
    expect(doc.contacts.some((c) => c.id === doc.activeContactId)).toBe(true);
  });

  it("covers the awkward card shapes the UI has to survive", () => {
    const { contacts, folders } = buildFakeData({ size: "sample" });

    // A company-only card (no first/last name) still has a display name.
    const companyOnly = contacts.find(
      (c) => !c.firstName && !c.lastName && c.company,
    );
    expect(companyOnly).toBeDefined();
    expect(displayName(companyOnly!)).toBe(companyOnly!.company);

    // A wholly blank card, an archived card, and a leap-day birthday.
    expect(
      contacts.some(
        (c) => !c.firstName && !c.lastName && !c.company && !c.phones.length,
      ),
    ).toBe(true);
    expect(contacts.some((c) => c.archived)).toBe(true);
    expect(contacts.some((c) => c.ice)).toBe(true);
    expect(contacts.some((c) => c.birthday === "2000-02-29")).toBe(true);

    // A card with many phones/emails, and one carrying photos — including a
    // multi-photo gallery that exercises the switcher and the swipeable viewer.
    expect(contacts.some((c) => c.phones.length >= 5)).toBe(true);
    expect(contacts.some((c) => (c.photos?.length ?? 0) > 0)).toBe(true);
    expect(contacts.some((c) => (c.photos?.length ?? 0) > 1)).toBe(true);

    // Folders include an empty one and an archived one.
    expect(folders.some((f) => f.archived)).toBe(true);
    const empty = folders.find((f) => f.id === "seed-fld-empty");
    expect(empty).toBeDefined();
    expect(contacts.some((c) => c.folderId === empty!.id)).toBe(false);
  });

  it("scales to roughly the requested count with unique ids", () => {
    const doc = buildFakeData({ size: 300 });
    expect(doc.contacts.length).toBeGreaterThanOrEqual(300);
    const ids = new Set(doc.contacts.map((c) => c.id));
    expect(ids.size).toBe(doc.contacts.length);
    // Every contact points at a real folder (or the root).
    const folderIds = new Set(doc.folders.map((f) => f.id));
    for (const c of doc.contacts) {
      if (c.folderId !== null) expect(folderIds.has(c.folderId)).toBe(true);
    }
  });

  it("never emits fewer than the curated set for a tiny count", () => {
    const sample = buildFakeData({ size: "sample" });
    const tiny = buildFakeData({ size: 1 });
    // A number below the curated size still yields the whole curated set.
    expect(tiny.contacts.length).toBe(sample.contacts.length);
  });
});

describe("createSeedBackend", () => {
  it("seeds each namespace in memory and round-trips edits", () => {
    const backend = createSeedBackend("sample");
    expect(backend.id).toBe("dev");

    const first = backend.load("default");
    expect(first.contacts.length).toBeGreaterThan(0);
    // Loading the same slug returns the same (now cached) document.
    expect(backend.load("default")).toBe(first);

    // Saving replaces the in-memory copy; the next load reflects the edit.
    const edited = { ...first, activeContactId: "seed-c-blank" };
    backend.save("default", edited);
    expect(backend.load("default").activeContactId).toBe("seed-c-blank");
  });

  it("keeps namespaces independent", () => {
    const backend = createSeedBackend("sample");
    const work = backend.load("work");
    backend.save("work", { ...work, activeContactId: "seed-c-blank" });
    // A different slug is seeded fresh, untouched by the edit above.
    expect(backend.load("home").activeContactId).toBe("seed-c-full");
  });

  it("does not touch localStorage (no global writes)", () => {
    // The backend is a pure in-memory Map — building and editing it must not
    // require a DOM/localStorage, which is why these tests run in node.
    const backend = createSeedBackend(50);
    const doc = backend.load("default");
    expect(doc.contacts.length).toBeGreaterThanOrEqual(50);
  });
});
