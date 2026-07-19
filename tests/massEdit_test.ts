// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  isEmptyMassEdit,
  massEditPatch,
  type MassEdit,
} from "../src/app/massEdit.ts";
import type { Contact } from "../src/app/types.ts";

// A minimal contact carrying only the fields the mass edit reads / writes.
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

describe("isEmptyMassEdit", () => {
  it("is empty for no facets, or an empty tag list", () => {
    expect(isEmptyMassEdit({})).toBe(true);
    expect(isEmptyMassEdit({ addTags: [] })).toBe(true);
  });

  it("is non-empty once any facet is set", () => {
    expect(isEmptyMassEdit({ addTags: ["a"] })).toBe(false);
    expect(isEmptyMassEdit({ relation: "" })).toBe(false); // clear counts
    expect(isEmptyMassEdit({ relation: "friend" })).toBe(false);
    expect(isEmptyMassEdit({ isCompany: false })).toBe(false);
  });
});

describe("massEditPatch — tags", () => {
  it("adds new tags to a card, keeping the ones it already has", () => {
    const patch = massEditPatch(contact({ tags: ["Boat club"] }), {
      addTags: ["Chess", "Boat club"],
    });
    expect(patch).toEqual({ tags: ["Boat club", "Chess"] });
  });

  it("is a no-op when the card already carries every added tag", () => {
    const patch = massEditPatch(contact({ tags: ["Chess"] }), {
      addTags: ["chess"], // case-insensitive dedupe
    });
    expect(patch).toBeNull();
  });

  it("seeds the tag list on a card that has none", () => {
    const patch = massEditPatch(contact({}), { addTags: ["Chess"] });
    expect(patch).toEqual({ tags: ["Chess"] });
  });
});

describe("massEditPatch — relationship", () => {
  it("sets the relationship", () => {
    const patch = massEditPatch(contact({}), { relation: "friend" });
    expect(patch).toEqual({ relation: "friend" });
  });

  it("clears the relationship with an empty string", () => {
    const patch = massEditPatch(contact({ relation: "friend" }), {
      relation: "",
    });
    expect(patch).toEqual({ relation: undefined });
  });

  it("is a no-op when the relationship already matches", () => {
    expect(
      massEditPatch(contact({ relation: "friend" }), { relation: "friend" }),
    ).toBeNull();
    // Clearing an already-empty relationship changes nothing either.
    expect(massEditPatch(contact({}), { relation: "" })).toBeNull();
  });
});

describe("massEditPatch — card type", () => {
  it("switches a person to a company, dropping the person-only fields", () => {
    const person = contact({
      birthday: "1980-02-29",
      importantDates: [{ id: "d1", label: "Name day", date: "07-05" }],
      ice: true,
    });
    const patch = massEditPatch(person, { isCompany: true });
    // Applied the way the store applies it: spread over the card.
    const patched = { ...person, ...patch };
    expect(patched.isCompany).toBe(true);
    expect(patched.company).toBe("Jane Doe");
    expect(patched.firstName).toBe("");
    expect(patched.birthday).toBeUndefined();
    expect(patched.importantDates).toEqual([]);
    expect(patched.ice).toBe(false);
  });

  it("switches a company back to a person", () => {
    const patch = massEditPatch(contact({ isCompany: true, company: "Acme" }), {
      isCompany: false,
    });
    expect(patch).toEqual({ isCompany: false });
  });

  it("is a no-op when the card is already the wanted type", () => {
    expect(massEditPatch(contact({}), { isCompany: false })).toBeNull();
    expect(
      massEditPatch(contact({ isCompany: true }), { isCompany: true }),
    ).toBeNull();
  });

  it("does not re-clear a person's fields when they are already a company", () => {
    // Setting company on a card that is *already* a company must not run the
    // person→company conversion again, so its (empty) name split isn't touched.
    const patch = massEditPatch(
      contact({
        isCompany: true,
        firstName: "",
        lastName: "",
        company: "Acme",
      }),
      { isCompany: true },
    );
    expect(patch).toBeNull();
  });
});

describe("massEditPatch — combined facets", () => {
  it("applies card type, relationship, and tags together", () => {
    const person = contact({ birthday: "1990-01-01" });
    const edit: MassEdit = {
      isCompany: true,
      relation: "business",
      addTags: ["Vendor"],
    };
    const patched = { ...person, ...massEditPatch(person, edit) };
    expect(patched.isCompany).toBe(true);
    expect(patched.birthday).toBeUndefined();
    // The relationship and tags a company keeps land on top of the conversion.
    expect(patched.relation).toBe("business");
    expect(patched.tags).toEqual(["Vendor"]);
  });

  it("returns just the facets that actually change", () => {
    // Company already set and relationship already matches — only the new tag
    // survives as a change.
    const patch = massEditPatch(
      contact({ isCompany: true, relation: "business", company: "Acme" }),
      { isCompany: true, relation: "business", addTags: ["Vendor"] },
    );
    expect(patch).toEqual({ tags: ["Vendor"] });
  });
});
