// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  canNestFolder,
  childrenByParent,
  descendantFolderIds,
  emergencyContacts,
  favoriteContacts,
  favoritePhones,
  groupContactsByFolder,
  listedContacts,
  orderedFolderTree,
  prioritizePhones,
  reorderIds,
  sortFolders,
  subtreeFolderIds,
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

  it("keeps folders in document order by default", () => {
    const data = doc({
      folders: [
        folder({ id: "f1", name: "Work" }),
        folder({ id: "f2", name: "Amigos" }),
      ],
      contacts: [
        card({ id: "a", folderId: "f1" }),
        card({ id: "b", folderId: "f2" }),
      ],
    });
    expect(groupContactsByFolder(data).map((g) => g.folder?.id)).toEqual([
      "f1",
      "f2",
    ]);
  });

  it("orders folders alphabetically when asked", () => {
    const data = doc({
      folders: [
        folder({ id: "f1", name: "Work" }),
        folder({ id: "f2", name: "Amigos" }),
      ],
      contacts: [
        card({ id: "a", folderId: "f1" }),
        card({ id: "b", folderId: "f2" }),
      ],
    });
    const groups = groupContactsByFolder(data, { folderSort: "alphabetical" });
    // Amigos (f2) sorts before Work (f1); the ungrouped null group still trails.
    expect(groups.map((g) => g.folder?.id)).toEqual(["f2", "f1"]);
  });

  it("walks subfolders depth-first, each under its parent, annotating depth", () => {
    const data = doc({
      folders: [
        folder({ id: "fam", name: "Family" }),
        folder({ id: "spouse", name: "Spouse", parentId: "fam" }),
        folder({ id: "cousins", name: "Cousins", parentId: "spouse" }),
      ],
      contacts: [
        card({ id: "a", firstName: "Ada", folderId: "fam" }),
        card({ id: "s", firstName: "Sam", folderId: "spouse" }),
        card({ id: "c", firstName: "Coz", folderId: "cousins" }),
      ],
    });
    const groups = groupContactsByFolder(data);
    expect(groups.map((g) => [g.folder?.id, g.depth])).toEqual([
      ["fam", 0],
      ["spouse", 1],
      ["cousins", 2],
    ]);
  });

  it("keeps a childless-but-not-empty parent as a reachable heading", () => {
    // Family holds no contacts of its own, but its Spouse subfolder does — so
    // Family still heads a (contact-less) section so the child is reachable.
    const data = doc({
      folders: [
        folder({ id: "fam", name: "Family" }),
        folder({ id: "spouse", name: "Spouse", parentId: "fam" }),
      ],
      contacts: [card({ id: "s", firstName: "Sam", folderId: "spouse" })],
    });
    const groups = groupContactsByFolder(data);
    expect(groups.map((g) => g.folder?.id)).toEqual(["fam", "spouse"]);
    expect(groups[0]!.contacts).toEqual([]);
    expect(groups[1]!.contacts.map((c) => c.id)).toEqual(["s"]);
  });

  it("drops a whole branch with no contacts anywhere in it", () => {
    const data = doc({
      folders: [
        folder({ id: "fam", name: "Family" }),
        folder({ id: "spouse", name: "Spouse", parentId: "fam" }),
        folder({ id: "work", name: "Work" }),
      ],
      contacts: [card({ id: "w", firstName: "Wes", folderId: "work" })],
    });
    // Family/Spouse are empty end-to-end and drop out; Work stays.
    expect(groupContactsByFolder(data).map((g) => g.folder?.id)).toEqual([
      "work",
    ]);
  });

  it("surfaces a subfolder as a root when its parent isn't present", () => {
    // The parent is archived (filtered out), so its non-archived child reads as
    // a root rather than vanishing.
    const data = doc({
      folders: [
        folder({ id: "fam", name: "Family", archived: true }),
        folder({ id: "spouse", name: "Spouse", parentId: "fam" }),
      ],
      contacts: [card({ id: "s", firstName: "Sam", folderId: "spouse" })],
    });
    const groups = groupContactsByFolder(data);
    expect(groups.map((g) => [g.folder?.id, g.depth])).toEqual([["spouse", 0]]);
  });
});

describe("childrenByParent", () => {
  it("groups folders by their parent, root folders under the null key", () => {
    const folders = [
      folder({ id: "fam", name: "Family" }),
      folder({ id: "spouse", name: "Spouse", parentId: "fam" }),
      folder({ id: "work", name: "Work" }),
    ];
    const byParent = childrenByParent(folders, "manual");
    expect(byParent.get(null)!.map((f) => f.id)).toEqual(["fam", "work"]);
    expect(byParent.get("fam")!.map((f) => f.id)).toEqual(["spouse"]);
  });

  it("treats a folder with a missing parent as a root", () => {
    const folders = [folder({ id: "spouse", parentId: "gone" })];
    expect(
      childrenByParent(folders, "manual")
        .get(null)!
        .map((f) => f.id),
    ).toEqual(["spouse"]);
  });

  it("orders each sibling group alphabetically when asked", () => {
    const folders = [
      folder({ id: "fam", name: "Family" }),
      folder({ id: "z", name: "Zoe", parentId: "fam" }),
      folder({ id: "a", name: "Ann", parentId: "fam" }),
    ];
    expect(
      childrenByParent(folders, "alphabetical")
        .get("fam")!
        .map((f) => f.id),
    ).toEqual(["a", "z"]);
  });
});

describe("orderedFolderTree", () => {
  it("flattens the tree depth-first with a depth on every node", () => {
    const folders = [
      folder({ id: "fam", name: "Family" }),
      folder({ id: "spouse", name: "Spouse", parentId: "fam" }),
      folder({ id: "cousins", name: "Cousins", parentId: "spouse" }),
      folder({ id: "work", name: "Work" }),
    ];
    expect(
      orderedFolderTree(folders, "manual").map((n) => [n.folder.id, n.depth]),
    ).toEqual([
      ["fam", 0],
      ["spouse", 1],
      ["cousins", 2],
      ["work", 0],
    ]);
  });

  it("emits a folder caught in a parent cycle only once", () => {
    // A corrupt loop (a ↔ b) must not spin forever.
    const folders = [
      folder({ id: "a", parentId: "b" }),
      folder({ id: "b", parentId: "a" }),
    ];
    const ids = orderedFolderTree(folders, "manual").map((n) => n.folder.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("descendantFolderIds / subtreeFolderIds", () => {
  const folders = [
    folder({ id: "fam", name: "Family" }),
    folder({ id: "spouse", name: "Spouse", parentId: "fam" }),
    folder({ id: "cousins", name: "Cousins", parentId: "spouse" }),
    folder({ id: "work", name: "Work" }),
  ];

  it("collects every id below a folder, excluding itself", () => {
    expect([...descendantFolderIds(folders, "fam")].sort()).toEqual([
      "cousins",
      "spouse",
    ]);
    expect([...descendantFolderIds(folders, "work")]).toEqual([]);
  });

  it("includes the root itself in the subtree", () => {
    expect([...subtreeFolderIds(folders, "spouse")].sort()).toEqual([
      "cousins",
      "spouse",
    ]);
  });
});

describe("canNestFolder", () => {
  const folders = [
    folder({ id: "fam", name: "Family" }),
    folder({ id: "spouse", name: "Spouse", parentId: "fam" }),
    folder({ id: "cousins", name: "Cousins", parentId: "spouse" }),
    folder({ id: "work", name: "Work" }),
  ];

  it("allows nesting into an unrelated folder or the root", () => {
    expect(canNestFolder(folders, "work", "fam")).toBe(true);
    expect(canNestFolder(folders, "spouse", null)).toBe(true);
  });

  it("forbids nesting into itself or its own descendant (a cycle)", () => {
    expect(canNestFolder(folders, "fam", "fam")).toBe(false);
    expect(canNestFolder(folders, "fam", "spouse")).toBe(false);
    expect(canNestFolder(folders, "fam", "cousins")).toBe(false);
  });
});

describe("sortFolders", () => {
  it("keeps the given order in manual mode", () => {
    const folders = [
      folder({ id: "f1", name: "Work" }),
      folder({ id: "f2", name: "Amigos" }),
    ];
    expect(sortFolders(folders, "manual").map((f) => f.id)).toEqual([
      "f1",
      "f2",
    ]);
  });

  it("sorts by name, case-insensitively, in alphabetical mode", () => {
    const folders = [
      folder({ id: "f1", name: "work" }),
      folder({ id: "f2", name: "Amigos" }),
      folder({ id: "f3", name: "Beta" }),
    ];
    expect(sortFolders(folders, "alphabetical").map((f) => f.id)).toEqual([
      "f2",
      "f3",
      "f1",
    ]);
  });

  it("never mutates the input", () => {
    const folders = [
      folder({ id: "f1", name: "Work" }),
      folder({ id: "f2", name: "Amigos" }),
    ];
    sortFolders(folders, "alphabetical");
    expect(folders.map((f) => f.id)).toEqual(["f1", "f2"]);
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

describe("favoritePhones", () => {
  const phones: Phone[] = [
    { id: "h", value: "111", label: "private" },
    { id: "w", value: "222", label: "work", primary: true },
    { id: "h2", value: "333" },
  ];

  it("shows only the primary number when one is flagged", () => {
    expect(favoritePhones(phones, "both").map((p) => p.id)).toEqual(["w"]);
    // The primary wins over the kind priority too — a private-priority list
    // still narrows to the flagged work number.
    expect(favoritePhones(phones, "private").map((p) => p.id)).toEqual(["w"]);
  });

  it("falls back to the prioritized list when no number is primary", () => {
    const none: Phone[] = [
      { id: "h", value: "111", label: "private" },
      { id: "w", value: "222", label: "work" },
    ];
    expect(favoritePhones(none, "both").map((p) => p.id)).toEqual(["h", "w"]);
    expect(favoritePhones(none, "work").map((p) => p.id)).toEqual(["w"]);
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

describe("favoriteContacts", () => {
  it("keeps only active, starred cards", () => {
    const data = doc({
      contacts: [
        card({ id: "a", firstName: "Ada", favorite: true }),
        card({ id: "b", firstName: "Bob" }),
        card({ id: "c", firstName: "Cy", favorite: true, archived: true }),
      ],
    });
    expect(favoriteContacts(data).map((c) => c.id)).toEqual(["a"]);
  });

  it("orders by favoriteOrder, then by name for unplaced cards", () => {
    const data = doc({
      contacts: [
        card({ id: "a", firstName: "Ada", favorite: true, favoriteOrder: 2 }),
        card({ id: "b", firstName: "Bob", favorite: true, favoriteOrder: 0 }),
        // No order yet — sorts after placed cards, by name (Cy before Zed).
        card({ id: "z", firstName: "Zed", favorite: true }),
        card({ id: "c", firstName: "Cy", favorite: true }),
      ],
    });
    expect(favoriteContacts(data).map((c) => c.id)).toEqual([
      "b",
      "a",
      "c",
      "z",
    ]);
  });
});

describe("reorderIds", () => {
  it("moves a dragged id to the target's position", () => {
    expect(reorderIds(["a", "b", "c", "d"], "d", "b")).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
    expect(reorderIds(["a", "b", "c", "d"], "a", "c")).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("is a no-op for the same id or a missing id", () => {
    expect(reorderIds(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(reorderIds(["a", "b"], "x", "b")).toEqual(["a", "b"]);
  });

  it("places the id before or after the target when a side is given", () => {
    // "before" drops the card immediately above the target row (pointer over
    // the target's upper half); "after" drops it immediately below.
    expect(reorderIds(["a", "b", "c", "d"], "a", "c", "before")).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
    expect(reorderIds(["a", "b", "c", "d"], "a", "c", "after")).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    // Dragging upward lands above / below the target the same way.
    expect(reorderIds(["a", "b", "c", "d"], "d", "b", "before")).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
    expect(reorderIds(["a", "b", "c", "d"], "d", "b", "after")).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
  });
});
