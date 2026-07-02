// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  compareContacts,
  displayName,
  initials,
  splitFullName,
} from "../src/app/types.ts";
import type { Contact } from "../src/app/types.ts";

function card(overrides: Partial<Contact>): Contact {
  return {
    id: "c",
    firstName: "",
    lastName: "",
    phones: [],
    emails: [],
    folderId: null,
    ...overrides,
  };
}

describe("displayName", () => {
  it("joins the name halves and falls back to the company", () => {
    expect(displayName(card({ firstName: "Ada", lastName: "Lovelace" }))).toBe(
      "Ada Lovelace",
    );
    expect(displayName(card({ firstName: "Ada" }))).toBe("Ada");
    expect(displayName(card({ company: "Acme" }))).toBe("Acme");
    expect(displayName(card({}))).toBe("");
  });
});

describe("initials", () => {
  it("builds a monogram from the name or company", () => {
    expect(initials(card({ firstName: "ada", lastName: "lovelace" }))).toBe(
      "AL",
    );
    expect(initials(card({ firstName: "Ada" }))).toBe("A");
    expect(initials(card({ company: "acme" }))).toBe("A");
    expect(initials(card({}))).toBe("");
  });
});

describe("splitFullName", () => {
  it("keeps the last word as the last name", () => {
    expect(splitFullName("Ada Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(splitFullName("Jean-Luc Marie Picard")).toEqual({
      firstName: "Jean-Luc Marie",
      lastName: "Picard",
    });
    expect(splitFullName("  Ada  ")).toEqual({
      firstName: "Ada",
      lastName: "",
    });
    expect(splitFullName("")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("compareContacts", () => {
  it("sorts alphabetically with nameless cards last", () => {
    const a = card({ id: "a", firstName: "Ada" });
    const b = card({ id: "b", firstName: "bo" });
    const empty = card({ id: "e" });
    expect([empty, b, a].sort(compareContacts).map((c) => c.id)).toEqual([
      "a",
      "b",
      "e",
    ]);
  });
});
