// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  contactToVCard,
  contactsToCsv,
  contactsToVCards,
  exportFileStem,
} from "../src/app/export.ts";
import type { Contact } from "../src/app/types.ts";

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

describe("contactToVCard", () => {
  it("renders the mandatory envelope with N and FN", () => {
    const v = contactToVCard(card());
    expect(v.startsWith("BEGIN:VCARD\r\nVERSION:3.0")).toBe(true);
    expect(v).toContain("N:Lovelace;Ada;;;");
    expect(v).toContain("FN:Ada Lovelace");
    expect(v.endsWith("END:VCARD")).toBe(true);
  });

  it("maps phone labels onto TEL types and defaults to CELL", () => {
    const v = contactToVCard(
      card({
        phones: [
          { id: "p1", value: "+46701234567" },
          { id: "p2", value: "+4681234567", label: "work" },
        ],
      }),
    );
    expect(v).toContain("TEL;TYPE=CELL:+46701234567");
    expect(v).toContain("TEL;TYPE=WORK:+4681234567");
  });

  it("escapes separators and newlines in text values", () => {
    const v = contactToVCard(
      card({ notes: "line one\nsemi; comma, back\\slash" }),
    );
    expect(v).toContain("NOTE:line one\\nsemi\\; comma\\, back\\\\slash");
  });

  it("tags emails with their private / work type", () => {
    const v = contactToVCard(
      card({
        emails: [
          { id: "e1", value: "me@home.example", label: "private" },
          { id: "e2", value: "me@work.example", label: "work" },
        ],
      }),
    );
    expect(v).toContain("EMAIL;TYPE=INTERNET,HOME:me@home.example");
    expect(v).toContain("EMAIL;TYPE=INTERNET,WORK:me@work.example");
  });

  it("writes one structured ADR per address, typed by its title", () => {
    const v = contactToVCard(
      card({
        addresses: [
          {
            id: "a1",
            label: "Home",
            street: "Main St 1",
            zip: "111 22",
            city: "Stockholm",
          },
          {
            id: "a2",
            label: "Work",
            street: "Office Rd 5",
            city: "Gothenburg",
          },
        ],
      }),
    );
    expect(v).toContain("ADR;TYPE=HOME:;;Main St 1;Stockholm;;111 22;");
    expect(v).toContain("ADR;TYPE=WORK:;;Office Rd 5;Gothenburg;;;");
  });

  it("exports full-date important dates as grouped X-ABDATE items", () => {
    const v = contactToVCard(
      card({
        importantDates: [
          { id: "d1", label: "Anniversary", date: "2010-06-15" },
          // A yearless date can't ride a vCard 3.0 date property — it's skipped.
          { id: "d2", label: "Name day", date: "05-20" },
        ],
      }),
    );
    expect(v).toContain("item1.X-ABDATE;VALUE=DATE:2010-06-15");
    expect(v).toContain("item1.X-ABLABEL:Anniversary");
    expect(v).not.toContain("05-20");
  });

  it("embeds the active gallery photo as a base64 PHOTO line", () => {
    const v = contactToVCard(
      card({
        photos: [
          { id: "ph1", photo: "data:image/jpeg;base64,b3RoZXI=" },
          { id: "ph2", photo: "data:image/jpeg;base64,aGVsbG8=" },
        ],
        activePhotoId: "ph2",
      }),
    );
    // Only the current face is exported, not the whole gallery.
    expect(v).toContain("PHOTO;ENCODING=b;TYPE=JPEG:aGVsbG8=");
    expect(v).not.toContain("b3RoZXI=");
  });

  it("exports a homepage as a URL line", () => {
    const v = contactToVCard(card({ homepage: "https://example.com" }));
    expect(v).toContain("URL:https://example.com");
  });

  it("marks a company card with X-ABShowAs and omits it for a person", () => {
    const company = contactToVCard(
      card({
        firstName: "",
        lastName: "",
        company: "Acme Inc",
        isCompany: true,
      }),
    );
    expect(company).toContain("ORG:Acme Inc");
    expect(company).toContain("X-ABShowAs:COMPANY");
    expect(company).toContain("FN:Acme Inc");

    const person = contactToVCard(card({ company: "Acme Inc" }));
    expect(person).not.toContain("X-ABShowAs");
  });

  it("exports a company's name as ORG even without a company field", () => {
    // A company card whose name still lives in first/last (e.g. imported, or
    // flagged before the name moved into `company`) should still export an
    // organisation from its display name — never an empty/absent ORG.
    const v = contactToVCard(
      card({ firstName: "Ada", lastName: "Corp", isCompany: true }),
    );
    expect(v).toContain("ORG:Ada Corp");
    expect(v).toContain("X-ABShowAs:COMPANY");
  });

  it("skips empty optional fields entirely", () => {
    const v = contactToVCard(card());
    expect(v).not.toContain("ORG:");
    expect(v).not.toContain("URL:");
    expect(v).not.toContain("X-ABShowAs");
    expect(v).not.toContain("TEL");
    expect(v).not.toContain("EMAIL");
    expect(v).not.toContain("PHOTO");
  });

  it("folds content lines longer than 75 characters", () => {
    const v = contactToVCard(card({ notes: "x".repeat(200) }));
    for (const line of v.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(76); // continuation lead space
    }
  });
});

describe("contactsToVCards", () => {
  it("joins multiple cards into one importable file", () => {
    const text = contactsToVCards([
      card(),
      card({ id: "c2", firstName: "Bo" }),
    ]);
    expect(text.match(/BEGIN:VCARD/g)).toHaveLength(2);
    expect(text.endsWith("\r\n")).toBe(true);
  });
});

describe("contactsToCsv", () => {
  it("writes Outlook's classic headers", () => {
    const csv = contactsToCsv([]);
    expect(csv.split("\r\n")[0]).toBe(
      "First Name,Last Name,Company,Mobile Phone,Home Phone,Business Phone," +
        "E-mail Address,E-mail 2 Address,Home Address,Birthday,Notes",
    );
  });

  it("routes labelled phones into their columns", () => {
    const csv = contactsToCsv([
      card({
        phones: [
          { id: "p1", value: "1", label: "home" },
          { id: "p2", value: "2", label: "work" },
          { id: "p3", value: "3" },
        ],
        emails: [
          { id: "e1", value: "a@example.com" },
          { id: "e2", value: "b@example.com" },
        ],
      }),
    ]);
    const row = csv.split("\r\n")[1]!;
    expect(row).toBe("Ada,Lovelace,,3,1,2,a@example.com,b@example.com,,,");
  });

  it("quotes fields containing commas, quotes, and newlines", () => {
    const csv = contactsToCsv([
      card({ company: 'Acme, "Inc"', notes: "two\nlines" }),
    ]);
    expect(csv).toContain('"Acme, ""Inc"""');
    expect(csv).toContain('"two\nlines"');
  });
});

describe("exportFileStem", () => {
  it("slugs the display name and falls back to 'contact'", () => {
    expect(exportFileStem(card())).toBe("ada-lovelace");
    expect(
      exportFileStem(card({ firstName: "", lastName: "", company: "" })),
    ).toBe("contact");
  });
});
