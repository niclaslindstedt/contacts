// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  DEFAULT_RELATIONS,
  customRelationsInUse,
  isDefaultRelation,
  normalizeRelationInput,
  relationLabel,
} from "../src/app/relation.ts";
import type { TFn } from "../src/app/i18n/index.ts";
import type { Contact } from "../src/app/types.ts";

// A translator stub that echoes the key it's given, so a built-in relation's
// label resolves to its catalog key and a custom one is returned verbatim.
const t = ((key: string) => key) as unknown as TFn;

function card(relation?: string): Contact {
  return {
    id: "c",
    firstName: "",
    lastName: "",
    relation,
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
  };
}

describe("isDefaultRelation", () => {
  it("recognises the five built-in keys and nothing else", () => {
    for (const key of DEFAULT_RELATIONS)
      expect(isDefaultRelation(key)).toBe(true);
    expect(isDefaultRelation("Family")).toBe(false); // keys are lowercase
    expect(isDefaultRelation("Neighbour")).toBe(false);
    expect(isDefaultRelation("")).toBe(false);
  });
});

describe("relationLabel", () => {
  it("resolves a built-in key through the catalog", () => {
    expect(relationLabel("family", t)).toBe("contact.relations.family");
    expect(relationLabel("business", t)).toBe("contact.relations.business");
  });

  it("shows a custom relationship verbatim and none for empty/absent", () => {
    expect(relationLabel("Neighbour", t)).toBe("Neighbour");
    expect(relationLabel("  ", t)).toBe("");
    expect(relationLabel(undefined, t)).toBe("");
  });
});

describe("normalizeRelationInput", () => {
  it("folds a typed built-in name onto its key, case-insensitively", () => {
    expect(normalizeRelationInput("Family")).toBe("family");
    expect(normalizeRelationInput("  friend ")).toBe("friend");
    expect(normalizeRelationInput("COLLEAGUE")).toBe("colleague");
  });

  it("keeps a genuinely custom label trimmed and verbatim", () => {
    expect(normalizeRelationInput("  Neighbour ")).toBe("Neighbour");
    expect(normalizeRelationInput("")).toBe("");
    expect(normalizeRelationInput("   ")).toBe("");
  });
});

describe("customRelationsInUse", () => {
  it("collects distinct custom values, drops built-ins and blanks", () => {
    const contacts = [
      card("family"), // built-in — excluded
      card("Neighbour"),
      card("neighbour"), // case-duplicate — folded
      card("Book club"),
      card("  "), // blank — excluded
      card(undefined),
    ];
    expect(customRelationsInUse(contacts)).toEqual(["Book club", "Neighbour"]);
  });
});
