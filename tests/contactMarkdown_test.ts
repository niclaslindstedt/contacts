// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { contactToMarkdown } from "../src/app/contactMarkdown.ts";
import { en } from "../src/app/i18n/en.ts";
import type { TFn } from "../src/app/i18n/index.ts";
import type { Contact } from "../src/app/types.ts";

// Resolve against the real English catalog so the rendered headings are the
// ones the UI shows, rather than raw keys.
const t = ((key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown>)[k],
      en as unknown as Record<string, unknown>,
    ) as string) as unknown as TFn;

const opts = {
  t,
  dateFormat: "iso",
  country: "SE",
  phone: {
    format: true,
    countryCode: true,
    countryCodeForeignOnly: false,
    leadingZero: true,
  },
  postal: { format: true, spaces: true },
} as const;

function card(patch: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
    ...patch,
  };
}

describe("contactToMarkdown", () => {
  it("titles the document with the display name and ends with one newline", () => {
    const md = contactToMarkdown(card(), opts);
    expect(md).toBe("# Ada Lovelace\n");
  });

  it("falls back to the placeholder title for a nameless card", () => {
    const md = contactToMarkdown(card({ firstName: "", lastName: "" }), opts);
    expect(md).toBe(`# ${en.contact.unnamed}\n`);
  });

  it("titles a company card by its company name and skips the company row", () => {
    const md = contactToMarkdown(
      card({
        firstName: "",
        lastName: "",
        isCompany: true,
        company: "Analytical Engines",
      }),
      opts,
    );
    expect(md).toBe("# Analytical Engines\n");
  });

  it("lists phones and emails under 'Get in touch', typed and formatted", () => {
    const md = contactToMarkdown(
      card({
        phones: [{ id: "p1", value: "701234567", countryCode: "46" }],
        emails: [
          { id: "e1", value: " ada@example.com " },
          { id: "e2", value: "ada@work.example", label: "work" },
        ],
      }),
      opts,
    );
    expect(md).toContain("## Get in touch");
    expect(md).toContain("- **Phone (Private):** +46 (0)70-123 45 67");
    expect(md).toContain("- **Email (Private):** ada@example.com");
    expect(md).toContain("- **Email (Work):** ada@work.example");
  });

  it("marks the primary number, but only when there is more than one", () => {
    const two = contactToMarkdown(
      card({
        phones: [
          { id: "p1", value: "701234567", countryCode: "46" },
          { id: "p2", value: "812345678", countryCode: "46", primary: true },
        ],
      }),
      opts,
    );
    expect(two).toContain("+46 (0)8-12 34 56 78 (Primary)");
    expect(two.match(/\(Primary\)/g)).toHaveLength(1);

    const one = contactToMarkdown(
      card({
        phones: [
          { id: "p1", value: "701234567", countryCode: "46", primary: true },
        ],
      }),
      opts,
    );
    expect(one).not.toContain("(Primary)");
  });

  it("skips blank phone and email rows", () => {
    const md = contactToMarkdown(
      card({
        phones: [{ id: "p1", value: "   " }],
        emails: [{ id: "e1", value: "" }],
      }),
      opts,
    );
    expect(md).toBe("# Ada Lovelace\n");
  });

  it("renders the details: company, relationship, website, and dates", () => {
    const md = contactToMarkdown(
      card({
        company: "Analytical Engines",
        relation: "friend",
        homepage: "example.com",
        birthday: "1815-12-10",
        importantDates: [
          { id: "d1", label: "Anniversary", date: "07-05" },
          { id: "d2", date: "1843-08-01" },
          { id: "d3", label: "Nonsense", date: "not-a-date" },
        ],
      }),
      opts,
    );
    expect(md).toContain("## Details");
    expect(md).toContain("- **Company:** Analytical Engines");
    expect(md).toContain("- **Relationship:** Friend");
    expect(md).toContain("- **Website:** [example.com](https://example.com)");
    expect(md).toContain("- **Birthday:** 1815-12-10");
    expect(md).toContain("- **Anniversary:** 07-05");
    // A date with no occasion falls back to the generic label…
    expect(md).toContain("- **Date:** 1843-08-01");
    // …and an unparseable one is left out entirely.
    expect(md).not.toContain("Nonsense");
  });

  it("keeps a custom relationship verbatim", () => {
    const md = contactToMarkdown(card({ relation: "Neighbour" }), opts);
    expect(md).toContain("- **Relationship:** Neighbour");
  });

  it("joins tags on one line and flattens each address onto its row", () => {
    const md = contactToMarkdown(
      card({
        tags: ["Boat club", "Board games"],
        addresses: [
          {
            id: "a1",
            label: "Home",
            street: "Nya gatan 1",
            zip: "12345",
            city: "Stockholm",
          },
          { id: "a2", city: "Paris" },
          { id: "a3" },
        ],
      }),
      opts,
    );
    expect(md).toContain("## Tags\n\nBoat club, Board games");
    expect(md).toContain("- **Home:** Nya gatan 1, 123 45 Stockholm");
    // A titleless address falls back to the generic label; an empty one is out.
    expect(md).toContain("- **Address:** Paris");
    expect(md.match(/^- \*\*/gm)).toHaveLength(2);
  });

  it("copies notes verbatim, newlines and Markdown of their own intact", () => {
    const md = contactToMarkdown(
      card({ notes: "  Met at the *fair*\nSecond line  " }),
      opts,
    );
    expect(md).toContain("## Notes\n\nMet at the *fair*\nSecond line\n");
  });

  it("escapes Markdown markup in values, but leaves underscores alone", () => {
    const md = contactToMarkdown(
      card({
        firstName: "A*da",
        lastName: "",
        company: "[Analytical](Engines)",
        emails: [{ id: "e1", value: "ada_l@example.com" }],
      }),
      opts,
    );
    expect(md).toContain("# A\\*da");
    expect(md).toContain("- **Company:** \\[Analytical\\](Engines)");
    expect(md).toContain("ada_l@example.com");
  });

  it("leaves out photos, attachments, and the card's app-local settings", () => {
    const md = contactToMarkdown(
      card({
        ice: true,
        favorite: true,
        archived: true,
        glyph: "heart",
        color: "#ff0000",
        autoArchiveDate: "2030-01-01",
        autoArchiveAction: "delete",
        activePhotoId: "ph1",
        photos: [{ id: "ph1", photo: "data:image/jpeg;base64,AAAA" }],
        attachments: [
          { id: "at1", name: "menu.pdf", mime: "application/pdf", size: 12 },
        ],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
      }),
      opts,
    );
    expect(md).toBe("# Ada Lovelace\n");
  });

  it("renders phones and dates in the chosen display conventions", () => {
    const md = contactToMarkdown(
      card({
        birthday: "1815-12-10",
        phones: [{ id: "p1", value: "701234567", countryCode: "46" }],
      }),
      {
        ...opts,
        dateFormat: "us",
        phone: { ...opts.phone, format: false },
      },
    );
    expect(md).toContain("- **Birthday:** 12/10/1815");
    expect(md).toContain("- **Phone (Private):** +46701234567");
  });

  it("orders the sections the way the card reads", () => {
    const md = contactToMarkdown(
      card({
        emails: [{ id: "e1", value: "ada@example.com" }],
        company: "Analytical Engines",
        tags: ["Maths"],
        addresses: [{ id: "a1", city: "London" }],
        notes: "A note",
      }),
      opts,
    );
    expect(md.match(/^## .*$/gm)).toEqual([
      "## Get in touch",
      "## Details",
      "## Tags",
      "## Addresses",
      "## Notes",
    ]);
  });
});
