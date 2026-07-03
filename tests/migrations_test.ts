// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  LATEST_VERSION,
  parseDoc,
  serializeDoc,
} from "../src/app/migrations.ts";
import type { AppData } from "../src/app/types.ts";

const doc: AppData = {
  folders: [{ id: "f1", name: "Friends" }],
  contacts: [
    {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      phones: [{ id: "p1", value: "+46701234567" }],
      emails: [],
      addresses: [],
      importantDates: [],
      folderId: "f1",
    },
  ],
  activeContactId: "c1",
};

describe("serializeDoc / parseDoc", () => {
  it("round-trips a document and stamps the version on the bytes", () => {
    const text = serializeDoc(doc);
    expect(JSON.parse(text).version).toBe(LATEST_VERSION);
    expect(parseDoc(text)).toEqual(doc);
  });

  it("upgrades a pre-versioning document through the chain", () => {
    const legacy = JSON.stringify({
      contacts: [{ id: "x", phones: null }],
    });
    const upgraded = parseDoc(legacy);
    expect(upgraded.folders).toEqual([]);
    expect(upgraded.contacts[0]).toMatchObject({
      id: "x",
      firstName: "",
      lastName: "",
      phones: [],
      emails: [],
      folderId: null,
    });
    expect(upgraded.activeContactId).toBe("x");
  });

  it("carries a legacy free-form address forward into the addresses array", () => {
    const legacy = JSON.stringify({
      version: 1,
      folders: [],
      contacts: [
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          phones: [],
          emails: [],
          folderId: null,
          address: "Main St 1\n111 22 Stockholm",
        },
      ],
      activeContactId: "c1",
    });
    const upgraded = parseDoc(legacy);
    const contact = upgraded.contacts[0]!;
    // v1→v2 split the blob into parts; v2→v3 moved them into the first address.
    expect(contact.addresses).toEqual([
      {
        id: "c1-address",
        street: "Main St 1",
        zip: "111 22",
        city: "Stockholm",
      },
    ]);
    expect(contact.importantDates).toEqual([]);
    expect("street" in contact).toBe(false);
    expect("address" in contact).toBe(false);
  });

  it("folds a v2 flat address into addresses and seeds importantDates", () => {
    const v2 = JSON.stringify({
      version: 2,
      folders: [],
      contacts: [
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          phones: [],
          emails: [],
          folderId: null,
          street: "Main St 1",
          zip: "111 22",
          city: "Stockholm",
        },
        // A contact with no address at all still gets both empty arrays.
        {
          id: "c2",
          firstName: "Bo",
          lastName: "Ek",
          phones: [],
          emails: [],
          folderId: null,
        },
      ],
      activeContactId: "c1",
    });
    const upgraded = parseDoc(v2);
    expect(upgraded.contacts[0]!.addresses).toEqual([
      {
        id: "c1-address",
        street: "Main St 1",
        zip: "111 22",
        city: "Stockholm",
      },
    ]);
    expect(upgraded.contacts[1]!.addresses).toEqual([]);
    expect(upgraded.contacts[1]!.importantDates).toEqual([]);
  });

  it("normalises a wiped or malformed file into an empty document", () => {
    expect(parseDoc("null")).toEqual({
      folders: [],
      contacts: [],
      activeContactId: "",
    });
  });
});
