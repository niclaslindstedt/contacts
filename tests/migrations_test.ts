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

  it("splits a legacy free-form address into street / zip / city", () => {
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
    expect(upgraded.contacts[0]).toMatchObject({
      street: "Main St 1",
      zip: "111 22",
      city: "Stockholm",
    });
    expect("address" in upgraded.contacts[0]!).toBe(false);
  });

  it("normalises a wiped or malformed file into an empty document", () => {
    expect(parseDoc("null")).toEqual({
      folders: [],
      contacts: [],
      activeContactId: "",
    });
  });
});
