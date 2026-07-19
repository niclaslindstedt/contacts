// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  allTags,
  contactTags,
  withTagAdded,
  withTagRemoved,
} from "../src/app/tags.ts";
import type { Contact } from "../src/app/types.ts";

function card(tags?: string[]): Contact {
  return {
    id: "c",
    firstName: "",
    lastName: "",
    tags,
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
  };
}

describe("contactTags", () => {
  it("reads an absent list as none", () => {
    expect(contactTags(card())).toEqual([]);
    expect(contactTags(card(["Boat club"]))).toEqual(["Boat club"]);
  });
});

describe("withTagAdded", () => {
  it("appends a trimmed tag", () => {
    expect(withTagAdded(["Boat club"], "  Board games ")).toEqual([
      "Boat club",
      "Board games",
    ]);
  });

  it("ignores a blank or duplicate tag by returning the same reference", () => {
    const tags = ["Boat club"];
    expect(withTagAdded(tags, "   ")).toBe(tags);
    // Case-insensitive dedupe, first-seen casing kept.
    expect(withTagAdded(tags, "boat club")).toBe(tags);
  });
});

describe("withTagRemoved", () => {
  it("drops a tag by exact value", () => {
    expect(withTagRemoved(["Boat club", "Board games"], "Boat club")).toEqual([
      "Board games",
    ]);
  });
});

describe("allTags", () => {
  it("collects distinct tags across the book, deduped and sorted", () => {
    const contacts = [
      card(["Boat club", "Board games"]),
      card(["board games", "  "]), // case-duplicate folded, blank dropped
      card(["Alumni"]),
      card(undefined),
    ];
    expect(allTags(contacts)).toEqual(["Alumni", "Board games", "Boat club"]);
  });
});
