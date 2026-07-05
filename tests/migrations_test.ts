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
      phones: [{ id: "p1", value: "701234567", countryCode: "46" }],
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

  it("folds a legacy single photo into the photos gallery (v3→v4)", () => {
    const v3 = JSON.stringify({
      version: 3,
      folders: [],
      contacts: [
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          phones: [],
          emails: [],
          addresses: [],
          importantDates: [],
          folderId: null,
          photo: "data:image/jpeg;base64,QUJD",
          photoSource: "data:image/jpeg;base64,REVG",
          photoTransform: { scale: 1.5, x: 0.1, y: -0.2 },
          photoPath: "photos/ada-lovelace-c1.jpg",
        },
        // A photo-less card gets no photos key at all (no bloat).
        {
          id: "c2",
          firstName: "Bo",
          lastName: "Ek",
          phones: [],
          emails: [],
          addresses: [],
          importantDates: [],
          folderId: null,
        },
      ],
      activeContactId: "c1",
    });
    const upgraded = parseDoc(v3);
    const ada = upgraded.contacts[0]!;
    expect(ada.photos).toEqual([
      {
        id: "c1-photo",
        photo: "data:image/jpeg;base64,QUJD",
        photoSource: "data:image/jpeg;base64,REVG",
        photoTransform: { scale: 1.5, x: 0.1, y: -0.2 },
        photoPath: "photos/ada-lovelace-c1.jpg",
      },
    ]);
    // The retired flat keys are gone.
    expect("photo" in ada).toBe(false);
    expect("photoSource" in ada).toBe(false);
    expect(upgraded.contacts[1]!.photos).toBeUndefined();
  });

  it("structures free-typed phone numbers (v4→v5)", () => {
    const v4 = JSON.stringify({
      version: 4,
      folders: [],
      contacts: [
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          phones: [
            // An international number: the code peels into `countryCode` and the
            // separators are stripped from the national digits.
            { id: "p1", value: "+46 (0)70-123 45 67", label: "work" },
            // A bare local number keeps no code — it follows the home country.
            { id: "p2", value: "08-123 45 67" },
          ],
          emails: [],
          addresses: [],
          importantDates: [],
          folderId: null,
        },
      ],
      activeContactId: "c1",
    });
    const ada = parseDoc(v4).contacts[0]!;
    expect(ada.phones).toEqual([
      { id: "p1", value: "0701234567", countryCode: "46", label: "work" },
      { id: "p2", value: "081234567" },
    ]);
  });

  it("stamps createdAt on cards that predate the timestamp field (v5→v6)", () => {
    const before = Date.now();
    const v5 = JSON.stringify({
      version: 5,
      folders: [],
      contacts: [
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          phones: [],
          emails: [],
          addresses: [],
          importantDates: [],
          folderId: null,
        },
      ],
      activeContactId: "c1",
    });
    const ada = parseDoc(v5).contacts[0]!;
    // A best-effort "first seen now": createdAt lands at the migration time and
    // updatedAt stays absent, so an untouched card shows no "Modified" stamp.
    expect(typeof ada.createdAt).toBe("string");
    expect(Date.parse(ada.createdAt!)).toBeGreaterThanOrEqual(before);
    expect(ada.updatedAt).toBeUndefined();
  });

  it("keeps an existing createdAt through the v5→v6 migration", () => {
    const v5 = JSON.stringify({
      version: 5,
      folders: [],
      contacts: [
        {
          id: "c1",
          firstName: "Ada",
          lastName: "Lovelace",
          phones: [],
          emails: [],
          addresses: [],
          importantDates: [],
          folderId: null,
          createdAt: "2020-01-01T00:00:00.000Z",
        },
      ],
      activeContactId: "c1",
    });
    expect(parseDoc(v5).contacts[0]!.createdAt).toBe(
      "2020-01-01T00:00:00.000Z",
    );
  });

  it("normalises a wiped or malformed file into an empty document", () => {
    expect(parseDoc("null")).toEqual({
      folders: [],
      contacts: [],
      activeContactId: "",
    });
  });
});
