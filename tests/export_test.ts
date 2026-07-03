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

  it("writes a structured ADR from street / city / zip", () => {
    const v = contactToVCard(
      card({ street: "Main St 1", zip: "111 22", city: "Stockholm" }),
    );
    expect(v).toContain("ADR;TYPE=HOME:;;Main St 1;Stockholm;;111 22;");
  });

  it("embeds a data-URI photo as a base64 PHOTO line", () => {
    const v = contactToVCard(
      card({ photo: "data:image/jpeg;base64,aGVsbG8=" }),
    );
    expect(v).toContain("PHOTO;ENCODING=b;TYPE=JPEG:aGVsbG8=");
  });

  it("skips empty optional fields entirely", () => {
    const v = contactToVCard(card());
    expect(v).not.toContain("ORG:");
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
