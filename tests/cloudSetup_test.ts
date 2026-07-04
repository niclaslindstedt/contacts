// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { evaluateCloudSetup, summarizeDoc } from "../src/app/cloudSetup.ts";
import { serializeDoc } from "../src/app/migrations.ts";
import type { AppData } from "../src/app/types.ts";

function contact(id: string, firstName: string): AppData["contacts"][number] {
  return {
    id,
    firstName,
    lastName: "",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
  };
}

const local: AppData = {
  folders: [{ id: "f1", name: "Friends" }],
  contacts: [contact("c1", "Ada")],
  activeContactId: "c1",
};

describe("summarizeDoc", () => {
  it("counts contacts and folders", () => {
    expect(summarizeDoc(local)).toEqual({ contacts: 1, folders: 1 });
  });
});

describe("evaluateCloudSetup", () => {
  it("returns the remote when the cloud holds differing contacts", () => {
    const remote: AppData = {
      folders: [],
      contacts: [contact("c2", "Grace"), contact("c3", "Katherine")],
      activeContactId: "c2",
    };
    const result = evaluateCloudSetup(serializeDoc(remote), local);
    expect(result).not.toBeNull();
    expect(summarizeDoc(result!)).toEqual({ contacts: 2, folders: 0 });
  });

  it("returns null when the cloud is empty (nothing to adopt)", () => {
    const empty: AppData = { folders: [], contacts: [], activeContactId: "" };
    expect(evaluateCloudSetup(serializeDoc(empty), local)).toBeNull();
  });

  it("returns null when the cloud matches this device (no reconcile needed)", () => {
    expect(evaluateCloudSetup(serializeDoc(local), local)).toBeNull();
  });

  it("ignores the active-contact pointer when comparing content", () => {
    const sameButOtherActive: AppData = { ...local, activeContactId: "" };
    expect(
      evaluateCloudSetup(serializeDoc(sameButOtherActive), local),
    ).toBeNull();
  });

  it("returns null when the remote bytes don't parse", () => {
    expect(evaluateCloudSetup("}{ not json", local)).toBeNull();
  });

  it("upgrades an older remote shape before comparing", () => {
    // A v1 document (pre-`addresses`) that carries a contact the device lacks
    // still parses, migrates, and counts as differing.
    const legacy = JSON.stringify({
      version: 1,
      folders: [],
      contacts: [
        { id: "c9", firstName: "Hedy", lastName: "", phones: [], emails: [] },
      ],
      activeContactId: "c9",
    });
    const result = evaluateCloudSetup(legacy, local);
    expect(result).not.toBeNull();
    expect(summarizeDoc(result!)).toEqual({ contacts: 1, folders: 0 });
  });
});
