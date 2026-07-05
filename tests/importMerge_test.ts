// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import type { ImportedContact } from "../src/app/import.ts";
import { mergeContactDraft, planImport } from "../src/app/importMerge.ts";
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

function draft(overrides: Partial<ImportedContact> = {}): ImportedContact {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    ...overrides,
  };
}

let seq = 0;
const mint = (prefix: string) => `${prefix}-${(seq += 1)}`;

describe("planImport", () => {
  it("files a card that matches nothing as a new contact", () => {
    const plan = planImport(
      [card()],
      [draft({ firstName: "Grace", lastName: "Hopper" })],
    );
    expect(plan.additions).toHaveLength(1);
    expect(plan.merges).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("merges silently on a shared normalized phone number", () => {
    const existing = card({
      phones: [{ id: "p1", value: "701234567", countryCode: "46" }],
    });
    const plan = planImport(
      [existing],
      [draft({ phones: [{ value: "701234567", countryCode: "46" }] })],
    );
    expect(plan.merges).toEqual([{ targetId: "c1", draft: expect.anything() }]);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("treats an absent country code as the home country when matching phones", () => {
    // Stored without a code (home country) vs imported with an explicit +46.
    const existing = card({ phones: [{ id: "p1", value: "701234567" }] });
    const plan = planImport(
      [existing],
      [draft({ phones: [{ value: "701234567", countryCode: "46" }] })],
    );
    expect(plan.merges).toHaveLength(1);
  });

  it("does not match phones whose explicit country codes differ", () => {
    const existing = card({
      firstName: "Grace",
      lastName: "Hopper",
      phones: [{ id: "p1", value: "701234567", countryCode: "1" }],
    });
    const plan = planImport(
      [existing],
      [
        draft({
          firstName: "Ada",
          lastName: "Lovelace",
          phones: [{ value: "701234567", countryCode: "46" }],
        }),
      ],
    );
    expect(plan.additions).toHaveLength(1);
  });

  it("merges silently on a shared email, case-insensitively", () => {
    const existing = card({
      emails: [{ id: "e1", value: "Ada@Example.com" }],
    });
    const plan = planImport(
      [existing],
      [draft({ emails: [{ value: "ada@example.com" }] })],
    );
    expect(plan.merges).toHaveLength(1);
  });

  it("merges silently when a phone matches and the name merely extends", () => {
    // We have "Andreas"; "Andreas Andersson" arrives with the same number.
    const existing = card({
      firstName: "Andreas",
      lastName: "",
      phones: [{ id: "p1", value: "701234567" }],
    });
    const plan = planImport(
      [existing],
      [
        draft({
          firstName: "Andreas",
          lastName: "Andersson",
          phones: [{ value: "701234567" }],
        }),
      ],
    );
    expect(plan.merges).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("asks first when a phone matches but the names disagree", () => {
    const existing = card({
      firstName: "Grace",
      lastName: "Hopper",
      phones: [{ id: "p1", value: "701234567" }],
    });
    const plan = planImport(
      [existing],
      [draft({ phones: [{ value: "701234567" }] })],
    );
    expect(plan.merges).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      targetId: "c1",
      targetName: "Grace Hopper",
      draftName: "Ada Lovelace",
    });
  });

  it("raises a conflict on the exact same normalized name", () => {
    const plan = planImport(
      [card()],
      [draft({ firstName: "ada", lastName: "LOVELACE" })],
    );
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.additions).toHaveLength(0);
  });

  it("matches company-only cards by company name", () => {
    const existing = card({
      firstName: "",
      lastName: "",
      company: "Acme AB",
      isCompany: true,
    });
    const plan = planImport(
      [existing],
      [draft({ firstName: "", lastName: "", company: "acme ab" })],
    );
    expect(plan.conflicts).toHaveLength(1);
  });

  it("never matches against archived contacts", () => {
    const plan = planImport([card({ archived: true })], [draft()]);
    expect(plan.additions).toHaveLength(1);
  });

  it("does not conflict two nameless cards", () => {
    const existing = card({ firstName: "", lastName: "" });
    const plan = planImport(
      [existing],
      [draft({ firstName: "", lastName: "", notes: "hello" })],
    );
    expect(plan.additions).toHaveLength(1);
  });

  it("prefers the phone/email match over a same-name card", () => {
    const byName = card({ id: "byName" });
    const byPhone = card({
      id: "byPhone",
      firstName: "Ada",
      lastName: "",
      phones: [{ id: "p1", value: "701234567" }],
    });
    const plan = planImport(
      [byName, byPhone],
      [draft({ phones: [{ value: "701234567" }] })],
    );
    expect(plan.merges).toEqual([
      { targetId: "byPhone", draft: expect.anything() },
    ]);
  });
});

describe("mergeContactDraft", () => {
  it("upgrades to the more precise name", () => {
    const merged = mergeContactDraft(
      card({ firstName: "Andreas", lastName: "" }),
      draft({ firstName: "Andreas", lastName: "Andersson" }),
      mint,
    );
    expect(merged.firstName).toBe("Andreas");
    expect(merged.lastName).toBe("Andersson");
  });

  it("keeps the existing name when the draft's is not more precise", () => {
    const merged = mergeContactDraft(
      card(),
      draft({ firstName: "Ada", lastName: "" }),
      mint,
    );
    expect(merged.firstName).toBe("Ada");
    expect(merged.lastName).toBe("Lovelace");
  });

  it("fills empty fields and never overwrites filled ones", () => {
    const merged = mergeContactDraft(
      card({ company: "Analytical Engines", birthday: "1815-12-10" }),
      draft({
        company: "Other Corp",
        homepage: "https://ada.example",
        birthday: "1900-01-01",
        notes: "met at the fair",
      }),
      mint,
    );
    expect(merged.company).toBe("Analytical Engines");
    expect(merged.birthday).toBe("1815-12-10");
    expect(merged.homepage).toBe("https://ada.example");
    expect(merged.notes).toBe("met at the fair");
  });

  it("appends distinct notes below existing ones", () => {
    const merged = mergeContactDraft(
      card({ notes: "old note" }),
      draft({ notes: "new note" }),
      mint,
    );
    expect(merged.notes).toBe("old note\nnew note");
    const again = mergeContactDraft(merged, draft({ notes: "new note" }), mint);
    expect(again.notes).toBe("old note\nnew note");
  });

  it("appends only the phones and emails the card doesn't already have", () => {
    const merged = mergeContactDraft(
      card({
        phones: [{ id: "p1", value: "701234567" }],
        emails: [{ id: "e1", value: "ada@example.com" }],
      }),
      draft({
        phones: [
          { value: "701234567", countryCode: "46" }, // same number, explicit code
          { value: "81234567", countryCode: "46" }, // new
        ],
        emails: [
          { value: "ADA@example.com" }, // same address, different case
          { value: "ada@work.example" }, // new
        ],
      }),
      mint,
    );
    expect(merged.phones.map((p) => p.value)).toEqual([
      "701234567",
      "81234567",
    ]);
    expect(merged.emails.map((e) => e.value)).toEqual([
      "ada@example.com",
      "ada@work.example",
    ]);
    // Appended rows got minted ids.
    expect(merged.phones[1]!.id).toMatch(/^phone-/);
    expect(merged.emails[1]!.id).toMatch(/^email-/);
  });

  it("dedupes addresses and important dates", () => {
    const merged = mergeContactDraft(
      card({
        addresses: [{ id: "a1", street: "Main St 1", city: "Town" }],
        importantDates: [{ id: "d1", label: "Anniversary", date: "06-01" }],
      }),
      draft({
        addresses: [
          { street: "main st 1", city: "town" },
          { street: "New Rd 2", city: "Ville" },
        ],
        importantDates: [
          { label: "anniversary", date: "06-01" },
          { label: "Name day", date: "03-04" },
        ],
      }),
      mint,
    );
    expect(merged.addresses).toHaveLength(2);
    expect(merged.importantDates).toHaveLength(2);
  });

  it("only adopts a photo when the card has none", () => {
    const bare = mergeContactDraft(card(), draft({ photo: "data:new" }), mint);
    expect(bare.photos).toHaveLength(1);
    expect(bare.photos![0]!.photo).toBe("data:new");

    const kept = mergeContactDraft(
      card({ photos: [{ id: "ph1", photo: "data:old" }] }),
      draft({ photo: "data:new" }),
      mint,
    );
    expect(kept.photos).toHaveLength(1);
    expect(kept.photos![0]!.photo).toBe("data:old");
  });

  it("never turns a named person into a company", () => {
    const merged = mergeContactDraft(
      card(),
      draft({ isCompany: true, company: "Acme AB" }),
      mint,
    );
    expect(merged.isCompany).toBeUndefined();

    const companyCard = mergeContactDraft(
      card({ firstName: "", lastName: "", company: "Acme AB" }),
      draft({ firstName: "", lastName: "", isCompany: true }),
      mint,
    );
    expect(companyCard.isCompany).toBe(true);
  });

  it("carries the ICE flag over and keeps attachments deduped", () => {
    const merged = mergeContactDraft(
      card({
        attachments: [
          { id: "at1", name: "menu.pdf", mime: "application/pdf", size: 10 },
        ],
      }),
      draft({
        ice: true,
        attachments: [
          { id: "x", name: "menu.pdf", mime: "application/pdf", size: 10 },
          { id: "y", name: "contract.pdf", mime: "application/pdf", size: 20 },
        ],
      }),
      mint,
    );
    expect(merged.ice).toBe(true);
    expect(merged.attachments!.map((a) => a.name)).toEqual([
      "menu.pdf",
      "contract.pdf",
    ]);
  });

  it("leaves the existing card object untouched", () => {
    const existing = card({ phones: [{ id: "p1", value: "1" }] });
    mergeContactDraft(existing, draft({ phones: [{ value: "2" }] }), mint);
    expect(existing.phones).toHaveLength(1);
  });
});
