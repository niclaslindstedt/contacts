// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { runSearch } from "../src/app/search.ts";
import type { AppData, Contact } from "../src/app/types.ts";

function card(overrides: Partial<Contact>): Contact {
  return {
    id: overrides.id ?? "c1",
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

const data: AppData = {
  folders: [],
  contacts: [
    card({
      id: "ada",
      firstName: "Ada",
      lastName: "Lovelace",
      phones: [{ id: "p1", value: "+46 70 123 45 67" }],
      emails: [{ id: "e1", value: "ada@analytical.engine" }],
      addresses: [
        {
          id: "a1",
          label: "Cabin",
          street: "Ferndown Cottage",
          city: "Ashdown",
        },
      ],
      importantDates: [{ id: "d1", label: "Anniversary", date: "1835-07-08" }],
      notes: "Met at the difference engine meetup.",
    }),
    card({ id: "bo", firstName: "Bo", lastName: "Ek", archived: true }),
    card({ id: "co", company: "Babbage & Co" }),
  ],
  activeContactId: "ada",
};

describe("runSearch", () => {
  it("matches names and surfaces them first", () => {
    const { results } = runSearch(data, "lovelace");
    expect(results).toHaveLength(1);
    expect(results[0]!.contactId).toBe("ada");
    expect(results[0]!.titleRanges).not.toBeNull();
  });

  it("matches phone numbers, emails, and notes as fields", () => {
    expect(runSearch(data, "123 45").results[0]!.fields[0]!.key).toMatch(
      /^phone-/,
    );
    expect(runSearch(data, "analytical").results[0]!.fields[0]!.key).toMatch(
      /^email-/,
    );
    expect(runSearch(data, "meetup").results[0]!.fields[0]!.key).toBe("notes");
  });

  it("matches an address title / parts and an important date", () => {
    expect(runSearch(data, "Ferndown").results[0]!.fields[0]!.key).toMatch(
      /^address-/,
    );
    expect(runSearch(data, "Cabin").results[0]!.fields[0]!.key).toMatch(
      /^address-/,
    );
    expect(runSearch(data, "Anniversary").results[0]!.fields[0]!.key).toMatch(
      /^date-/,
    );
  });

  it("skips archived contacts", () => {
    expect(runSearch(data, "Bo Ek").results).toHaveLength(0);
  });

  it("titles a nameless card by its company", () => {
    const { results } = runSearch(data, "babbage");
    expect(results[0]!.title).toBe("Babbage & Co");
  });

  it("flags an invalid regex instead of matching", () => {
    const outcome = runSearch(data, "/[/");
    expect(outcome.invalidRegex).toBe(true);
    expect(outcome.results).toHaveLength(0);
  });

  it("returns nothing for an empty query", () => {
    expect(runSearch(data, "").results).toHaveLength(0);
  });
});
