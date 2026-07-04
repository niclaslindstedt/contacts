// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  groupContactsByFolder,
  listedContacts,
} from "../src/app/contactList.ts";
import type { AppData, Contact, Folder } from "../src/app/types.ts";

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

  it("keeps an empty folder but drops the empty ungrouped group", () => {
    const data = doc({ folders: [folder({ id: "f1" })], contacts: [] });
    const groups = groupContactsByFolder(data);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.folder?.id).toBe("f1");
    expect(groups[0]!.contacts).toEqual([]);
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
