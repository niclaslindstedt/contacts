// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { companyTogglePatch } from "../src/app/companyCard.ts";
import type { Contact } from "../src/app/types.ts";

// A minimal contact with just the fields the conversion reads and clears —
// the rest of the card shape is irrelevant to the toggle.
function contact(patch: Partial<Contact>): Contact {
  return {
    id: patch.id ?? "c1",
    firstName: "Jane",
    lastName: "Doe",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
    ...patch,
  };
}

describe("companyTogglePatch (turning on)", () => {
  it("drops the person-only fields, not just hides them", () => {
    const person = contact({
      birthday: "1980-02-29",
      importantDates: [{ id: "d1", label: "Name day", date: "07-05" }],
      ice: true,
    });
    // Applied the way the store applies it: spread over the card.
    const patched = { ...person, ...companyTogglePatch(person, true) };
    expect(patched.isCompany).toBe(true);
    expect(patched.birthday).toBeUndefined();
    expect(patched.importantDates).toEqual([]);
    expect(patched.ice).toBe(false);
  });

  it("promotes the person's name into a blank company field", () => {
    const patch = companyTogglePatch(contact({}), true);
    expect(patch.company).toBe("Jane Doe");
    expect(patch.firstName).toBe("");
    expect(patch.lastName).toBe("");
  });

  it("keeps an existing company name but still clears the name split", () => {
    const patch = companyTogglePatch(contact({ company: "Acme Inc" }), true);
    expect(patch.company).toBeUndefined();
    expect(patch.firstName).toBe("");
    expect(patch.lastName).toBe("");
  });

  it("leaves a nameless blank-company card without a company name", () => {
    const patch = companyTogglePatch(
      contact({ firstName: "", lastName: "" }),
      true,
    );
    expect(patch.company).toBeUndefined();
  });

  it("promotes a half name (first only) into the company field", () => {
    const patch = companyTogglePatch(contact({ lastName: "" }), true);
    expect(patch.company).toBe("Jane");
  });

  it("treats a whitespace-only company as blank and promotes the name", () => {
    const patch = companyTogglePatch(contact({ company: "  " }), true);
    expect(patch.company).toBe("Jane Doe");
  });

  it("leaves the company-agnostic fields untouched", () => {
    const patch = companyTogglePatch(
      contact({ notes: "hello", homepage: "https://example.com" }),
      true,
    );
    expect(patch).not.toHaveProperty("notes");
    expect(patch).not.toHaveProperty("homepage");
    expect(patch).not.toHaveProperty("phones");
    expect(patch).not.toHaveProperty("emails");
  });
});

describe("companyTogglePatch (turning off)", () => {
  it("only drops the company flag — the company text stays put", () => {
    const patch = companyTogglePatch(
      contact({ isCompany: true, company: "Acme Inc" }),
      false,
    );
    expect(patch).toEqual({ isCompany: false });
  });
});
