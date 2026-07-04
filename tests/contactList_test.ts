// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  emergencyContacts,
  groupContactsByFolder,
  listedContacts,
  prioritizePhones,
} from "../src/app/contactList.ts";
import type { AppData, Contact, Folder, Phone } from "../src/app/types.ts";

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

function folder(overrides: Partial<Folder> = {}): Folder {
  return { id: "f1", name: "Work", ...overrides };
}

function doc(overrides: Partial<AppData> = {}): AppData {
  return { folders: [], contacts: [], activeContactId: "", ...overrides };
}

describe("groupContactsByFolder", () => {
  it("groups active contacts under their folder, folders first", () => {
    const data = doc({
      folders: [folder({ id: "f1", name: "Work" })],
      contacts: [
        card({ id: "a", firstName: "Ada", folderId: "f1" }),
        card({ id: "b", firstName: "Bob", folderId: null }),
      ],
    });
    const groups = groupContactsByFolder(data);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.folder?.id).toBe("f1");
    expect(groups[0]!.contacts.map((c) => c.id)).toEqual(["a"]);
    // The ungrouped contacts trail in a null group.
    expect(groups[1]!.folder).toBeNull();
    expect(groups[1]!.contacts.map((c) => c.id)).toEqual(["b"]);
  });

  it("drops empty folders and the empty ungrouped group", () => {
    const data = doc({ folders: [folder({ id: "f1" })], contacts: [] });
    const groups = groupContactsByFolder(data);
    expect(groups).toHaveLength(0);
  });

  it("keeps a folder that still holds an active contact", () => {
    const data = doc({
      folders: [folder({ id: "f1" }), folder({ id: "f2", name: "Empty" })],
      contacts: [card({ id: "a", folderId: "f1" })],
    });
    const groups = groupContactsByFolder(data);
    expect(groups.map((g) => g.folder?.id ?? null)).toEqual(["f1"]);
  });

  it("leaves out archived folders and archived contacts", () => {
    const data = doc({
      folders: [
        folder({ id: "f1", name: "Work" }),
        folder({ id: "f2", name: "Old", archived: true }),
      ],
      contacts: [
        card({ id: "a", firstName: "Ada", folderId: "f1" }),
        card({ id: "z", firstName: "Zed", folderId: "f1", archived: true }),
        card({ id: "o", firstName: "Ozy", folderId: "f2" }),
      ],
    });
    const groups = groupContactsByFolder(data);
    expect(groups.map((g) => g.folder?.id ?? null)).toEqual(["f1"]);
    expect(groups[0]!.contacts.map((c) => c.id)).toEqual(["a"]);
  });

  it("keeps only starred contacts when favoritesOnly is set", () => {
    const data = doc({
      folders: [folder({ id: "f1", name: "Work" })],
      contacts: [
        card({ id: "a", firstName: "Ada", folderId: "f1", favorite: true }),
        card({ id: "b", firstName: "Bob", folderId: "f1" }),
        card({ id: "c", firstName: "Cyd", folderId: null, favorite: true }),
        card({ id: "d", firstName: "Dan", folderId: null }),
      ],
    });
    const groups = groupContactsByFolder(data, { favoritesOnly: true });
    expect(groups.map((g) => g.folder?.id ?? null)).toEqual(["f1", null]);
    expect(groups[0]!.contacts.map((c) => c.id)).toEqual(["a"]);
    expect(groups[1]!.contacts.map((c) => c.id)).toEqual(["c"]);
  });

  it("drops a folder whose only favorite is archived", () => {
    const data = doc({
      folders: [folder({ id: "f1" })],
      contacts: [
        card({ id: "a", folderId: "f1", favorite: true, archived: true }),
        card({ id: "b", folderId: "f1" }),
      ],
    });
    expect(groupContactsByFolder(data, { favoritesOnly: true })).toHaveLength(
      0,
    );
  });

  it("returns no groups when nothing is starred", () => {
    const data = doc({
      contacts: [card({ id: "a" }), card({ id: "b" })],
    });
    expect(groupContactsByFolder(data, { favoritesOnly: true })).toHaveLength(
      0,
    );
  });

  it("sorts contacts within a group by display name, nameless last", () => {
    const data = doc({
      contacts: [
        card({ id: "n", firstName: "", lastName: "", company: "" }),
        card({ id: "b", firstName: "Bob", lastName: "" }),
        card({ id: "a", firstName: "Ada", lastName: "" }),
      ],
    });
    const [group] = groupContactsByFolder(data);
    expect(group!.contacts.map((c) => c.id)).toEqual(["a", "b", "n"]);
  });
});

describe("prioritizePhones", () => {
  const phones: Phone[] = [
    { id: "h", value: "111", label: "private" },
    { id: "w", value: "222", label: "work" },
    { id: "h2", value: "333" }, // no label → private
  ];

  it("keeps every number when priority is both", () => {
    expect(prioritizePhones(phones, "both").map((p) => p.id)).toEqual([
      "h",
      "w",
      "h2",
    ]);
  });

  it("keeps only the preferred kind when it exists", () => {
    expect(prioritizePhones(phones, "work").map((p) => p.id)).toEqual(["w"]);
    expect(prioritizePhones(phones, "private").map((p) => p.id)).toEqual([
      "h",
      "h2",
    ]);
  });

  it("falls back to every number when the preferred kind is absent", () => {
    const workOnly: Phone[] = [{ id: "w", value: "222", label: "work" }];
    expect(prioritizePhones(workOnly, "private").map((p) => p.id)).toEqual([
      "w",
    ]);
  });
});

describe("emergencyContacts", () => {
  it("returns only the ICE-flagged contacts, in display order", () => {
    const data = doc({
      contacts: [
        card({ id: "b", firstName: "Bob", ice: true }),
        card({ id: "plain", firstName: "Cara" }),
        card({ id: "a", firstName: "Ada", ice: true }),
      ],
    });
    expect(emergencyContacts(data).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("pins ICE contacts regardless of the folder they're filed in", () => {
    const data = doc({
      folders: [folder({ id: "f1" })],
      contacts: [
        card({ id: "a", firstName: "Ada", folderId: "f1", ice: true }),
        card({ id: "b", firstName: "Bob", folderId: null, ice: true }),
      ],
    });
    expect(emergencyContacts(data).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("leaves out archived ICE contacts", () => {
    const data = doc({
      contacts: [
        card({ id: "a", firstName: "Ada", ice: true }),
        card({ id: "z", firstName: "Zed", ice: true, archived: true }),
      ],
    });
    expect(emergencyContacts(data).map((c) => c.id)).toEqual(["a"]);
  });

  it("is empty when nothing is flagged", () => {
    const data = doc({ contacts: [card({ id: "a", firstName: "Ada" })] });
    expect(emergencyContacts(data)).toEqual([]);
  });
});

describe("listedContacts", () => {
  it("flattens every group's contacts in render order", () => {
    const data = doc({
      folders: [folder({ id: "f1" })],
      contacts: [
        card({ id: "a", firstName: "Ada", folderId: "f1" }),
        card({ id: "b", firstName: "Bob", folderId: null }),
      ],
    });
    const flat = listedContacts(groupContactsByFolder(data));
    expect(flat.map((c) => c.id)).toEqual(["a", "b"]);
  });
});
