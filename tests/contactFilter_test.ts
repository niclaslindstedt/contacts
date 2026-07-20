// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  EMPTY_FILTER,
  activeFilterCount,
  filterContacts,
  isFilterActive,
  matchesFilter,
  relationsInUse,
  type ContactFilter,
} from "../src/app/contactFilter.ts";
import type { Contact } from "../src/app/types.ts";

function card(overrides: Partial<Contact> = {}): Contact {
  return {
    id: Math.random().toString(36).slice(2),
    firstName: "",
    lastName: "",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
    ...overrides,
  };
}

const filter = (overrides: Partial<ContactFilter> = {}): ContactFilter => ({
  ...EMPTY_FILTER,
  ...overrides,
});

describe("isFilterActive / activeFilterCount", () => {
  it("the empty filter is inactive", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
  });

  it("counts each set facet", () => {
    expect(activeFilterCount(filter({ relation: "family" }))).toBe(1);
    expect(activeFilterCount(filter({ tag: "Boat club" }))).toBe(1);
    expect(activeFilterCount(filter({ cardType: "company" }))).toBe(1);
    const all = filter({ relation: "family", tag: "x", cardType: "person" });
    expect(activeFilterCount(all)).toBe(3);
    expect(isFilterActive(all)).toBe(true);
  });
});

describe("matchesFilter", () => {
  it("passes everything under the empty filter", () => {
    expect(matchesFilter(card(), EMPTY_FILTER)).toBe(true);
    expect(matchesFilter(card({ isCompany: true }), EMPTY_FILTER)).toBe(true);
  });

  it("filters by card type", () => {
    const person = card();
    const company = card({ isCompany: true });
    expect(matchesFilter(person, filter({ cardType: "person" }))).toBe(true);
    expect(matchesFilter(company, filter({ cardType: "person" }))).toBe(false);
    expect(matchesFilter(company, filter({ cardType: "company" }))).toBe(true);
    expect(matchesFilter(person, filter({ cardType: "company" }))).toBe(false);
  });

  it("filters by relationship, case-insensitively", () => {
    const fam = card({ relation: "family" });
    const custom = card({ relation: "Neighbour" });
    expect(matchesFilter(fam, filter({ relation: "family" }))).toBe(true);
    expect(matchesFilter(fam, filter({ relation: "friend" }))).toBe(false);
    expect(matchesFilter(custom, filter({ relation: "neighbour" }))).toBe(true);
    // A card with no relationship never matches a relationship filter.
    expect(matchesFilter(card(), filter({ relation: "family" }))).toBe(false);
  });

  it("filters by tag, case-insensitively and across the whole list", () => {
    const c = card({ tags: ["Boat club", "Chess"] });
    expect(matchesFilter(c, filter({ tag: "chess" }))).toBe(true);
    expect(matchesFilter(c, filter({ tag: "Boat club" }))).toBe(true);
    expect(matchesFilter(c, filter({ tag: "golf" }))).toBe(false);
    expect(matchesFilter(card(), filter({ tag: "golf" }))).toBe(false);
  });

  it("requires every set facet to match (AND)", () => {
    const c = card({ relation: "family", tags: ["Chess"], isCompany: false });
    const f = filter({ relation: "family", tag: "Chess", cardType: "person" });
    expect(matchesFilter(c, f)).toBe(true);
    // Flip one facet each and it fails.
    expect(matchesFilter(c, { ...f, tag: "Golf" })).toBe(false);
    expect(matchesFilter(c, { ...f, cardType: "company" })).toBe(false);
    expect(matchesFilter(c, { ...f, relation: "friend" })).toBe(false);
  });
});

describe("filterContacts", () => {
  const list = [
    card({ relation: "family", tags: ["Chess"] }),
    card({ relation: "friend", tags: ["Golf"] }),
    card({ isCompany: true, tags: ["Chess"] }),
  ];

  it("returns a copy of the whole list when inactive", () => {
    const out = filterContacts(list, EMPTY_FILTER);
    expect(out).toHaveLength(3);
    expect(out).not.toBe(list);
  });

  it("keeps only the matching cards", () => {
    expect(filterContacts(list, filter({ tag: "chess" }))).toHaveLength(2);
    expect(filterContacts(list, filter({ relation: "family" }))).toHaveLength(
      1,
    );
    expect(filterContacts(list, filter({ cardType: "company" }))).toHaveLength(
      1,
    );
    expect(
      filterContacts(list, filter({ cardType: "company", tag: "golf" })),
    ).toHaveLength(0);
  });
});

describe("relationsInUse", () => {
  it("lists built-ins in canonical order, then customs sorted", () => {
    const contacts = [
      card({ relation: "friend" }),
      card({ relation: "Zebra club" }),
      card({ relation: "family" }),
      card({ relation: "Apple" }),
      card({ relation: "family" }), // dup built-in
      card(), // no relation — contributes nothing
    ];
    expect(relationsInUse(contacts)).toEqual([
      "family",
      "friend",
      "Apple",
      "Zebra club",
    ]);
  });

  it("dedupes customs case-insensitively, keeping first-seen casing", () => {
    const contacts = [
      card({ relation: "Neighbour" }),
      card({ relation: "neighbour" }),
    ];
    expect(relationsInUse(contacts)).toEqual(["Neighbour"]);
  });

  it("is empty when no card carries a relationship", () => {
    expect(relationsInUse([card(), card({ relation: "  " })])).toEqual([]);
  });
});
