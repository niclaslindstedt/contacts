// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// The demo address book is the live demo and what the App Store screenshots
// photograph, so it is held to what a reader would notice first: a card that
// says nothing, a date that has gone stale, a number that could ring
// somebody, a file that will not open — and to the premise of each staged
// frame (the card that fits a phone, the regex that finds the hackerspace,
// the card that archives itself).
import { beforeAll, describe, expect, it } from "vitest";

import { dueContacts, isoDate } from "../src/app/autoArchive.ts";
import { CONTACT_GLYPH_PATHS } from "../src/app/contactGlyphs.ts";
import {
  buildDemoData,
  DEMO_CONTACT_SPECS,
  loadDemoPhotos,
  resolveDemoDay,
} from "../src/app/dev/demoData.ts";
import { DEMO_PHOTOS } from "../src/app/dev/demoPhotos.ts";
import { createDemoBackend } from "../src/app/dev/seedBackend.ts";
import { daysUntilDate } from "../src/app/importantDates.ts";
import { parseDoc, serializeDoc } from "../src/app/migrations.ts";
import { runSearch } from "../src/app/search.ts";
import { displayName, type AppData, type Contact } from "../src/app/types.ts";

// The portraits live in a lazy chunk (kept out of the app's main bundle);
// load them once so built documents carry their photos, as they do in the
// app after `setDevDataMode("demo")` resolves.
const NOW = new Date(2026, 8, 26, 10, 30).getTime();
let doc: AppData;
beforeAll(async () => {
  await loadDemoPhotos();
  doc = buildDemoData(NOW);
});
const card = (slug: string): Contact => {
  const c = doc.contacts.find((x) => x.id === `demo-c-${slug}`);
  if (!c) throw new Error(`no demo card ${slug}`);
  return c;
};

describe("buildDemoData", () => {
  it("is the same book for the same moment, and a fresh copy each call", () => {
    const again = buildDemoData(NOW);
    expect(again).toEqual(doc);
    expect(again).not.toBe(doc);
    expect(again.contacts).not.toBe(doc.contacts);
  });

  it("round-trips through the app's own document format", () => {
    expect(parseDoc(serializeDoc(doc))).toEqual(doc);
  });

  it("is a book of people a reader can picture, each with a note", () => {
    expect(doc.contacts.length).toBeGreaterThanOrEqual(35);
    expect(doc.contacts.length).toBeLessThanOrEqual(60);
    for (const c of doc.contacts) {
      expect(displayName(c)).not.toBe("");
      // The notes are the product: every card says something the stock
      // address book has no field for — in a line or two, not a paragraph.
      expect(c.notes?.trim(), displayName(c)).toBeTruthy();
      expect(c.notes!.length, displayName(c)).toBeLessThanOrEqual(90);
    }
  });

  it("uses unique ids for every card and field row", () => {
    const ids = new Set<string>();
    for (const c of doc.contacts) {
      for (const row of [
        c,
        ...c.phones,
        ...c.emails,
        ...c.addresses,
        ...c.importantDates,
        ...(c.attachments ?? []),
        ...(c.photos ?? []),
      ]) {
        expect(ids.has(row.id), row.id).toBe(false);
        ids.add(row.id);
      }
    }
  });

  it("files every card into a real folder (or the root)", () => {
    const folderIds = new Set(doc.folders.map((f) => f.id));
    for (const c of doc.contacts) {
      if (c.folderId !== null) expect(folderIds.has(c.folderId)).toBe(true);
    }
    for (const f of doc.folders) {
      if (f.parentId != null) expect(folderIds.has(f.parentId)).toBe(true);
    }
    // The old job's folder is archived whole.
    const old = doc.folders.find((f) => f.archived)!;
    const inOld = doc.contacts.filter((c) => c.folderId === old.id);
    expect(inOld.length).toBeGreaterThan(0);
    expect(inOld.every((c) => c.archived)).toBe(true);
  });

  it("dials only numbers reserved for fiction", () => {
    for (const c of doc.contacts) {
      // One number to reach them on, whenever there is a number at all.
      expect(c.phones.filter((p) => p.primary).length).toBe(
        c.phones.length ? 1 : 0,
      );
      for (const p of c.phones) {
        expect(p.value).toMatch(/^\d+$/);
        const full = `+${p.countryCode}${p.value}`;
        // US 555-0100…0199, Swedish 070-174 06xx.
        expect(full, displayName(c)).toMatch(
          /^(\+1\d{3}55501\d\d|\+467017406\d\d)$/,
        );
      }
    }
  });

  it("keeps mail and homepages on reserved example domains", () => {
    for (const c of doc.contacts) {
      for (const e of c.emails) {
        const domain = e.value.split("@")[1] ?? "";
        expect(domain === "example.com" || domain.endsWith(".example")).toBe(
          true,
        );
      }
      if (c.homepage)
        expect(c.homepage).toMatch(/^https:\/\/[a-z.]+\.example$/);
    }
  });

  it("stamps every card in the past, relative to the moment it opens", () => {
    let edited = 0;
    for (const c of doc.contacts) {
      const created = Date.parse(c.createdAt!);
      expect(created).toBeLessThan(NOW);
      if (c.updatedAt) {
        edited++;
        const updated = Date.parse(c.updatedAt);
        expect(updated).toBeGreaterThan(created);
        expect(updated).toBeLessThan(NOW);
      }
    }
    expect(edited).toBeGreaterThanOrEqual(8);
    // A year on, the book has moved with the clock.
    const later = buildDemoData(NOW + 365 * 86_400_000);
    const priya = later.contacts.find((c) => c.id === "demo-c-priya")!;
    expect(Date.parse(priya.createdAt!)).toBeGreaterThan(
      Date.parse(card("priya").createdAt!),
    );
  });

  it("only wears glyphs the app can draw, and faces it ships", () => {
    const slugs = new Set(DEMO_CONTACT_SPECS.map((s) => s.slug));
    // No face in the chunk that no card wears.
    for (const key of Object.keys(DEMO_PHOTOS))
      expect(slugs.has(key)).toBe(true);
    for (const c of doc.contacts) {
      if (c.glyph) {
        expect(CONTACT_GLYPH_PATHS[c.glyph]).toBeDefined();
        expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
      }
      // A company wears its glyph; a person, a face.
      if (c.isCompany) expect(c.glyph).toBeTruthy();
      else expect(c.photos?.length, displayName(c)).toBe(1);
    }
    const prefix = "data:image/jpeg;base64,";
    for (const photo of Object.values(DEMO_PHOTOS)) {
      const bytes = Buffer.from(photo.slice(prefix.length), "base64");
      expect(photo.startsWith(prefix)).toBe(true);
      expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
      expect(bytes.length).toBeLessThan(8192);
    }
  });

  it("attaches real files whose sizes match their bytes", () => {
    const files = doc.contacts.flatMap((c) => c.attachments ?? []);
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const a of files) {
      const [head, b64] = a.data!.split(",");
      expect(head).toBe(`data:${a.mime};base64`);
      const bytes = Buffer.from(b64, "base64");
      expect(a.size).toBe(bytes.length);
      if (a.mime === "application/pdf") {
        expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      } else {
        expect(bytes.toString("utf8")).toMatch(/^<svg[\s>]/);
      }
    }
  });
});

// The premise of each store frame, so the data cannot drift out from under
// the recipes that photograph it.
describe("the frames the demo is staged for", () => {
  it("opens on Priya, whose card says who she is and fits a phone", () => {
    expect(doc.activeContactId).toBe("demo-c-priya");
    const priya = card("priya");
    expect(daysUntilDate(priya.birthday!, new Date(NOW))).toBe(9);
    expect(priya.tags?.length).toBeGreaterThanOrEqual(2);
    expect(priya.addresses).toHaveLength(0);
    expect(priya.importantDates).toHaveLength(0);
    expect(priya.phones).toHaveLength(1);
    // One number and nothing else to reach her on: the note has the room.
    expect(priya.emails).toHaveLength(0);
  });

  it("keeps the birthday nine days off whenever the demo opens", () => {
    for (const offset of [0, 40, 200, 330]) {
      const now = NOW + offset * 86_400_000;
      const priya = buildDemoData(now).contacts.find(
        (c) => c.id === "demo-c-priya",
      )!;
      expect(daysUntilDate(priya.birthday!, new Date(now))).toBe(9);
    }
  });

  it("finds the hackerspace with one regex, in notes and a file name", () => {
    const { results, invalidRegex } = runSearch(doc, "/solder|laser|3d print/");
    expect(invalidRegex).toBe(false);
    expect(results.map((r) => r.contactId).sort()).toEqual(
      ["dev", "ellie", "foundry", "greta", "marcus", "priya", "walt"].map(
        (s) => `demo-c-${s}`,
      ),
    );
  });

  it("fills the List's first screen with the family, faces and all", () => {
    const family = doc.contacts.filter((c) => c.folderId === "demo-fld-family");
    expect(family.length).toBeGreaterThanOrEqual(6);
    expect(family.filter((c) => c.ice)).toHaveLength(2);
  });

  it("clips an image and a PDF to the electrician", () => {
    const mimes = (card("luis").attachments ?? []).map((a) => a.mime);
    expect(mimes.some((m) => m.startsWith("image/"))).toBe(true);
    expect(mimes).toContain("application/pdf");
  });

  it("lets the cabin card tidy itself away — after the trip, never before", () => {
    const today = isoDate(new Date(NOW));
    const gus = card("gus");
    expect(gus.autoArchiveAction).toBe("archive");
    expect(gus.autoArchiveDate! > today).toBe(true);
    for (const d of gus.importantDates) {
      expect(d.date > today).toBe(true);
      expect(d.date < gus.autoArchiveDate!).toBe(true);
    }
    // Nothing in the book is due on the day the demo opens.
    const due = dueContacts(doc.contacts, today);
    expect(due.toArchive).toHaveLength(0);
    expect(due.toDelete).toHaveLength(0);
  });

  it("stars eight favorites in hand-placed order, each on a primary number", () => {
    const favorites = doc.contacts.filter((c) => c.favorite);
    expect(favorites).toHaveLength(8);
    expect(
      favorites.map((c) => c.favoriteOrder).sort((a, b) => a! - b!),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const c of favorites) {
      expect(c.phones.some((p) => p.primary)).toBe(true);
      expect(c.photos?.length).toBe(1);
    }
  });

  it("resolves authored days against the moment", () => {
    expect(resolveDemoDay("1991-06-14", NOW)).toBe("1991-06-14");
    expect(resolveDemoDay({ inDays: 3 }, NOW)).toBe("2026-09-29");
    expect(resolveDemoDay({ inDays: 9, year: 1992 }, NOW)).toBe("1992-10-05");
  });
});

describe("createDemoBackend", () => {
  it("seeds each namespace in memory and round-trips edits", () => {
    const backend = createDemoBackend();
    expect(backend.id).toBe("dev");

    const first = backend.load("default");
    expect(first.activeContactId).toBe("demo-c-priya");
    // Loading the same slug returns the same (now cached) document.
    expect(backend.load("default")).toBe(first);

    // Saving replaces the in-memory copy; the next load reflects the edit.
    const edited = { ...first, activeContactId: "demo-c-luis" };
    backend.save("default", edited);
    expect(backend.load("default").activeContactId).toBe("demo-c-luis");
    // A different slug is seeded fresh, untouched by the edit above.
    expect(backend.load("home").activeContactId).toBe("demo-c-priya");
  });
});
