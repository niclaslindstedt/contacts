// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeAll, describe, expect, it } from "vitest";

import { CONTACT_GLYPH_PATHS } from "../src/app/contactGlyphs.ts";
import { buildDemoData, loadDemoPhotos } from "../src/app/dev/demoData.ts";
import { createDemoBackend } from "../src/app/dev/seedBackend.ts";
import { displayName } from "../src/app/types.ts";

// The portraits live in a lazy chunk (kept out of the app's main bundle);
// load them once so built documents carry their photos, as they do in the
// app after `setDevDataMode("demo")` resolves.
beforeAll(() => loadDemoPhotos());

describe("buildDemoData", () => {
  it("returns a fresh, deterministic document each call", () => {
    const a = buildDemoData();
    const b = buildDemoData();
    // Same content…
    expect(a).toEqual(b);
    // …but not the same object (edits must not mutate the template).
    expect(a).not.toBe(b);
    expect(a.contacts).not.toBe(b.contacts);
  });

  it("holds roughly a hundred contacts, every one presentable", () => {
    const { contacts } = buildDemoData();
    expect(contacts.length).toBeGreaterThanOrEqual(100);
    // No blank cards in the showcase — every card has a display name.
    for (const c of contacts) {
      expect(displayName(c)).not.toBe("");
    }
  });

  it("opens on a contact that exists in the document", () => {
    const doc = buildDemoData();
    expect(doc.contacts.some((c) => c.id === doc.activeContactId)).toBe(true);
  });

  it("uses unique ids for every card and field row", () => {
    const { contacts } = buildDemoData();
    const ids = new Set<string>();
    const add = (id: string) => {
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    };
    for (const c of contacts) {
      add(c.id);
      for (const row of [
        ...c.phones,
        ...c.emails,
        ...c.addresses,
        ...c.importantDates,
        ...(c.attachments ?? []),
        ...(c.photos ?? []),
      ]) {
        add(row.id);
      }
    }
  });

  it("files every card into a real folder (or the root)", () => {
    const { contacts, folders } = buildDemoData();
    const folderIds = new Set(folders.map((f) => f.id));
    for (const c of contacts) {
      if (c.folderId !== null) expect(folderIds.has(c.folderId)).toBe(true);
    }
    // Subfolders point at present parents (Family ▸ In-laws, Work ▸ Clients).
    for (const f of folders) {
      if (f.parentId != null) expect(folderIds.has(f.parentId)).toBe(true);
    }
    expect(folders.some((f) => f.parentId)).toBe(true);
    // The previous employer's folder is archived, with archived cards inside.
    const archivedFolder = folders.find((f) => f.archived);
    expect(archivedFolder).toBeDefined();
    const inArchived = contacts.filter(
      (c) => c.folderId === archivedFolder!.id,
    );
    expect(inArchived.length).toBeGreaterThan(0);
    expect(inArchived.every((c) => c.archived)).toBe(true);
  });

  it("stores phones structured, with at most one primary per card", () => {
    const { contacts } = buildDemoData();
    expect(contacts.some((c) => c.phones.length >= 2)).toBe(true);
    for (const c of contacts) {
      for (const p of c.phones) {
        // National digits only — no separators, no leading `+`.
        expect(p.value).toMatch(/^\d+$/);
        // Authored in international format, so every number carries its code.
        expect(p.countryCode).toMatch(/^\d{1,3}$/);
        expect(["private", "work"]).toContain(p.label);
      }
      expect(c.phones.filter((p) => p.primary).length).toBeLessThanOrEqual(1);
    }
  });

  it("keeps every address, email, and homepage on reserved example domains", () => {
    const { contacts } = buildDemoData();
    for (const c of contacts) {
      for (const e of c.emails) {
        const domain = e.value.split("@")[1] ?? "";
        expect(domain === "example.com" || domain.endsWith(".example")).toBe(
          true,
        );
      }
      if (c.homepage) {
        expect(c.homepage).toMatch(/^https:\/\/[a-z.]+\.example$/);
      }
    }
  });

  it("writes well-formed birthdays and important dates", () => {
    const { contacts } = buildDemoData();
    let birthdays = 0;
    let yearless = 0;
    for (const c of contacts) {
      if (c.birthday) {
        birthdays++;
        expect(c.birthday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      for (const d of c.importantDates) {
        expect(d.label).toBeTruthy();
        // Full ISO when the year is known, bare MM-DD when it isn't.
        expect(d.date).toMatch(/^(\d{4}-)?\d{2}-\d{2}$/);
        if (!/^\d{4}-/.test(d.date)) yearless++;
      }
    }
    // A meticulous owner records plenty of birthdays and some name days.
    expect(birthdays).toBeGreaterThanOrEqual(30);
    expect(yearless).toBeGreaterThanOrEqual(3);
  });

  it("exercises the app-local flags a lived-in book carries", () => {
    const { contacts } = buildDemoData();
    // Emergency contacts pin to the top of the menu.
    expect(contacts.filter((c) => c.ice).length).toBeGreaterThanOrEqual(2);
    // Favorites carry explicit, unique hand-placed positions.
    const favorites = contacts.filter((c) => c.favorite);
    expect(favorites.length).toBeGreaterThanOrEqual(5);
    const orders = favorites.map((c) => c.favoriteOrder);
    expect(orders.every((o) => typeof o === "number")).toBe(true);
    expect(new Set(orders).size).toBe(favorites.length);
    // Company cards are flagged as companies, named by the company alone.
    const companies = contacts.filter((c) => c.isCompany);
    expect(companies.length).toBeGreaterThanOrEqual(10);
    for (const c of companies) {
      expect(c.firstName).toBe("");
      expect(c.lastName).toBe("");
      expect(c.company).toBeTruthy();
    }
    // A card that files itself away when the holiday ends.
    expect(contacts.some((c) => c.autoArchiveDate && c.autoArchiveAction)).toBe(
      true,
    );
    // A few realistically archived cards outside the archived folder too.
    expect(contacts.some((c) => c.archived && c.folderId === null)).toBe(true);
  });

  it("stamps every card with a realistic added / edited date", () => {
    const { contacts } = buildDemoData();
    // A ceiling the whole book stays under, so nothing reads as added/edited
    // in the future.
    const ceiling = Date.parse("2026-06-01T00:00:00.000Z");
    let edited = 0;
    for (const c of contacts) {
      expect(c.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const created = Date.parse(c.createdAt!);
      expect(created).toBeLessThanOrEqual(ceiling);
      if (c.updatedAt) {
        edited++;
        const updated = Date.parse(c.updatedAt);
        // Never edited before it existed, never in the future.
        expect(updated).toBeGreaterThan(created);
        expect(updated).toBeLessThanOrEqual(ceiling);
      }
    }
    // A lived-in book has plenty of cards edited since they were added.
    expect(edited).toBeGreaterThanOrEqual(10);
    // The showcase card the demo opens on shows both halves of the stamp.
    const sara = contacts.find((c) => c.id === "demo-c-sara")!;
    expect(sara.createdAt).toBeTruthy();
    expect(sara.updatedAt).toBeTruthy();
    // The previous employer's archived cards belong to an older era than the
    // freshest active card.
    const archived = contacts.filter((c) => c.archived && c.createdAt);
    const newestActive = Math.max(
      ...contacts
        .filter((c) => !c.archived)
        .map((c) => Date.parse(c.createdAt!)),
    );
    expect(archived.length).toBeGreaterThan(0);
    for (const c of archived) {
      expect(Date.parse(c.createdAt!)).toBeLessThan(newestActive);
    }
  });

  it("only wears glyphs the app can draw", () => {
    const { contacts } = buildDemoData();
    let glyphs = 0;
    for (const c of contacts) {
      if (!c.glyph) continue;
      glyphs++;
      expect(CONTACT_GLYPH_PATHS[c.glyph]).toBeDefined();
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(glyphs).toBeGreaterThanOrEqual(20);
  });

  it("wears real portrait photos on most cards", () => {
    const { contacts } = buildDemoData();
    const withPhoto = contacts.filter((c) => (c.photos?.length ?? 0) > 0);
    // Most of the book is cast with a portrait — but, like a real address
    // book, not every card has one.
    expect(withPhoto.length).toBeGreaterThanOrEqual(60);
    expect(withPhoto.length).toBeLessThan(contacts.length);
    const prefix = "data:image/jpeg;base64,";
    for (const c of withPhoto) {
      const p = c.photos![0]!;
      expect(p.photo?.startsWith(prefix)).toBe(true);
      const bytes = Buffer.from(p.photo!.slice(prefix.length), "base64");
      // A real JPEG (SOI marker), kept small — these ship in the bundle.
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes.length).toBeLessThan(8192);
    }
  });

  it("attaches real PDF documents with matching byte sizes", () => {
    const { contacts } = buildDemoData();
    const attachments = contacts.flatMap((c) => c.attachments ?? []);
    expect(attachments.length).toBeGreaterThanOrEqual(2);
    for (const a of attachments) {
      expect(a.mime).toBe("application/pdf");
      const prefix = "data:application/pdf;base64,";
      expect(a.data?.startsWith(prefix)).toBe(true);
      const bytes = Buffer.from(a.data!.slice(prefix.length), "base64");
      // A real PDF, whose declared size matches the decoded bytes.
      expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(a.size).toBe(bytes.length);
    }
  });
});

describe("createDemoBackend", () => {
  it("seeds each namespace in memory and round-trips edits", () => {
    const backend = createDemoBackend();
    expect(backend.id).toBe("dev");

    const first = backend.load("default");
    expect(first.activeContactId).toBe("demo-c-sara");
    // Loading the same slug returns the same (now cached) document.
    expect(backend.load("default")).toBe(first);

    // Saving replaces the in-memory copy; the next load reflects the edit.
    const edited = { ...first, activeContactId: "demo-c-markus" };
    backend.save("default", edited);
    expect(backend.load("default").activeContactId).toBe("demo-c-markus");
    // A different slug is seeded fresh, untouched by the edit above.
    expect(backend.load("home").activeContactId).toBe("demo-c-sara");
  });
});
