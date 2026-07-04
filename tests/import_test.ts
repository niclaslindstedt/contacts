// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  detectFormat,
  parseCsv,
  parseImportFile,
  parseJson,
  parseVCards,
} from "../src/app/import.ts";
import {
  contactToVCard,
  contactsToCsv,
  contactsToVCards,
} from "../src/app/export.ts";
import { serializeDoc } from "../src/app/migrations.ts";
import type { AppData, Contact } from "../src/app/types.ts";

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

describe("parseVCards", () => {
  it("parses name, company, phone, and email out of a 3.0 card", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Lovelace;Ada;;;",
      "FN:Ada Lovelace",
      "ORG:Analytical Engines",
      "TEL;TYPE=CELL:+46701234567",
      "TEL;TYPE=WORK:+4681234567",
      "EMAIL;TYPE=INTERNET,HOME:ada@example.com",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(vcf);
    expect(c).toBeDefined();
    expect(c!.firstName).toBe("Ada");
    expect(c!.lastName).toBe("Lovelace");
    expect(c!.company).toBe("Analytical Engines");
    expect(c!.phones).toEqual([
      { value: "+46701234567", label: "private" },
      { value: "+4681234567", label: "work" },
    ]);
    expect(c!.emails).toEqual([{ value: "ada@example.com", label: "private" }]);
  });

  it("reads several cards from one file", () => {
    const vcf =
      "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:One Person\r\nEND:VCARD\r\n" +
      "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Two Person\r\nEND:VCARD\r\n";
    const cards = parseVCards(vcf);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.lastName)).toEqual(["Person", "Person"]);
    expect(cards.map((c) => c.firstName)).toEqual(["One", "Two"]);
  });

  it("falls back to FN when N is absent", () => {
    const vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Grace Hopper\r\nEND:VCARD";
    const [c] = parseVCards(vcf);
    expect(c!.firstName).toBe("Grace");
    expect(c!.lastName).toBe("Hopper");
  });

  it("unfolds folded lines and unescapes text", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Long Name",
      "NOTE:first line\\nsecond line\\, still go",
      " ing and folded on",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(vcf);
    expect(c!.notes).toBe("first line\nsecond line, still going and folded on");
  });

  it("parses ADR into street/city/zip and labels by TYPE", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Home Body",
      "ADR;TYPE=HOME:;;12 Baker St;London;;NW1 6XE;UK",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(vcf);
    expect(c!.addresses).toEqual([
      { label: "Home", street: "12 Baker St", city: "London", zip: "NW1 6XE" },
    ]);
  });

  it("routes a full BDAY to birthday and a yearless one to important dates", () => {
    const full = parseVCards(
      "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:A B\r\nBDAY:1990-05-02\r\nEND:VCARD",
    )[0]!;
    expect(full.birthday).toBe("1990-05-02");

    const yearless = parseVCards(
      "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:A B\r\nBDAY:--0502\r\nEND:VCARD",
    )[0]!;
    expect(yearless.birthday).toBeUndefined();
    expect(yearless.importantDates).toEqual([
      { label: "Birthday", date: "05-02" },
    ]);
  });

  it("marries Apple X-ABDATE/X-ABLABEL groups into important dates", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Sarah Connor",
      "item1.X-ABDATE;VALUE=DATE:2010-06-15",
      "item1.X-ABLABEL:_$!<Anniversary>!$_",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(vcf);
    expect(c!.importantDates).toEqual([
      { label: "Anniversary", date: "2010-06-15" },
    ]);
  });

  it("decodes an embedded base64 PHOTO into a data URI", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Pic Person",
      "PHOTO;ENCODING=b;TYPE=JPEG:/9j/AAAQSkZJRg==",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(vcf);
    expect(c!.photo).toBe("data:image/jpeg;base64,/9j/AAAQSkZJRg==");
  });

  it("decodes quoted-printable values from a 2.1-style card", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:2.1",
      "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=C3=85berg;=C3=85sa",
      "TEL;CELL:123",
      "END:VCARD",
    ].join("\r\n");
    const [c] = parseVCards(vcf);
    expect(c!.lastName).toBe("Åberg");
    expect(c!.firstName).toBe("Åsa");
  });

  it("drops empty or contentless cards", () => {
    const vcf =
      "BEGIN:VCARD\r\nVERSION:3.0\r\nEND:VCARD\r\n" +
      "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Real Person\r\nEND:VCARD";
    expect(parseVCards(vcf)).toHaveLength(1);
  });
});

describe("round-trips through export", () => {
  it("re-parses a card the app exported", () => {
    const original = card({
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Engines",
      phones: [
        { id: "p1", value: "+46701234567", label: "private" },
        { id: "p2", value: "+4681234567", label: "work" },
      ],
      emails: [{ id: "e1", value: "ada@example.com", label: "work" }],
      addresses: [
        {
          id: "a1",
          label: "Work",
          street: "1 Road",
          city: "Town",
          zip: "12345",
        },
      ],
      birthday: "1815-12-10",
    });
    const [back] = parseVCards(contactToVCard(original));
    expect(back!.firstName).toBe("Ada");
    expect(back!.lastName).toBe("Lovelace");
    expect(back!.company).toBe("Engines");
    expect(back!.phones).toEqual([
      { value: "+46701234567", label: "private" },
      { value: "+4681234567", label: "work" },
    ]);
    expect(back!.emails).toEqual([{ value: "ada@example.com", label: "work" }]);
    expect(back!.addresses).toEqual([
      { label: "Work", street: "1 Road", city: "Town", zip: "12345" },
    ]);
    expect(back!.birthday).toBe("1815-12-10");
  });

  it("re-parses a multi-card export", () => {
    const cards = [
      card({ id: "a", firstName: "Ada", lastName: "Lovelace" }),
      card({ id: "g", firstName: "Grace", lastName: "Hopper" }),
    ];
    const back = parseVCards(contactsToVCards(cards));
    expect(back.map((c) => c.firstName)).toEqual(["Ada", "Grace"]);
  });
});

describe("parseJson", () => {
  it("extracts non-archived contacts from an app backup", () => {
    const doc: AppData = {
      folders: [],
      contacts: [
        card({ id: "a", firstName: "Ada", lastName: "Lovelace" }),
        card({ id: "z", firstName: "Zed", lastName: "Gone", archived: true }),
      ],
      activeContactId: "a",
    };
    const cards = parseJson(serializeDoc(doc));
    expect(cards).toHaveLength(1);
    expect(cards[0]!.firstName).toBe("Ada");
  });

  it("round-trips the in-case-of-emergency flag", () => {
    const doc: AppData = {
      folders: [],
      contacts: [
        card({ id: "a", firstName: "Ada", ice: true }),
        card({ id: "b", firstName: "Bob" }),
      ],
      activeContactId: "a",
    };
    const cards = parseJson(serializeDoc(doc));
    expect(cards.find((c) => c.firstName === "Ada")?.ice).toBe(true);
    expect(cards.find((c) => c.firstName === "Bob")?.ice).toBeUndefined();
  });
});

describe("parseCsv", () => {
  it("maps Outlook columns and re-parses the app's own CSV export", () => {
    const cards = [
      card({
        firstName: "Ada",
        lastName: "Lovelace",
        company: "Engines",
        phones: [{ id: "p1", value: "555", label: "work" }],
        emails: [{ id: "e1", value: "ada@x.com" }],
      }),
    ];
    const csv = contactsToCsv(cards);
    const [c] = parseCsv(csv);
    expect(c!.firstName).toBe("Ada");
    expect(c!.lastName).toBe("Lovelace");
    expect(c!.company).toBe("Engines");
    expect(c!.phones).toContainEqual({ value: "555", label: "work" });
    expect(c!.emails).toContainEqual({ value: "ada@x.com", label: "private" });
  });

  it("honours quoted fields with commas and drops empty rows", () => {
    const csv =
      "First Name,Last Name,Notes\r\n" +
      'Ada,"Love, lace","a, b"\r\n' +
      ",,\r\n";
    const cards = parseCsv(csv);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.lastName).toBe("Love, lace");
    expect(cards[0]!.notes).toBe("a, b");
  });
});

describe("detectFormat / parseImportFile", () => {
  it("detects by extension", () => {
    expect(detectFormat("contacts.vcf", "")).toBe("vcard");
    expect(detectFormat("backup.json", "")).toBe("json");
    expect(detectFormat("sheet.csv", "")).toBe("csv");
  });

  it("sniffs content when the extension is unhelpful", () => {
    expect(detectFormat("blob", "BEGIN:VCARD\nEND:VCARD")).toBe("vcard");
    expect(detectFormat("blob", '{"version":3}')).toBe("json");
    expect(detectFormat("blob", "a,b,c\n1,2,3")).toBe("csv");
    expect(detectFormat("blob", "no delimiters here")).toBeNull();
  });

  it("dispatches to the right reader and never throws on junk", () => {
    const vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:X Y\r\nEND:VCARD";
    expect(parseImportFile("c.vcf", vcf)).toHaveLength(1);
    expect(parseImportFile("c.json", "not json{")).toEqual([]);
    expect(parseImportFile("c.bin", "\x00\x01\x02")).toEqual([]);
  });
});
