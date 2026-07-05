// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  backupDisplayName,
  backupFileName,
  backupPath,
  createBackupZip,
  formatBackupDate,
  parseBackups,
  readBackupDoc,
} from "../src/app/backup.ts";
import type { AppData } from "../src/app/types.ts";

function doc(overrides: Partial<AppData> = {}): AppData {
  return {
    contacts: [],
    folders: [],
    activeContactId: "",
    ...overrides,
  };
}

const AT = new Date(2026, 6, 4, 11, 45, 26); // 2026-07-04 11:45:26 local

describe("backup archives", () => {
  it("packs and unpacks the full document", async () => {
    const data = doc({
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
    const zip = await createBackupZip(data, AT);
    const text = await readBackupDoc(zip);
    const parsed = JSON.parse(text) as AppData & { version: number };
    expect(parsed.version).toBe(5);
    expect(parsed.contacts).toHaveLength(1);
    expect(parsed.contacts[0]!.firstName).toBe("Ada");
  });

  it("rejects a ZIP that isn't a contacts backup", async () => {
    // A valid ZIP, but without the contacts.json member.
    const { createZip } = await import("../src/app/zip.ts");
    const stray = await createZip([
      { name: "readme.txt", data: new TextEncoder().encode("hi") },
    ]);
    await expect(readBackupDoc(stray)).rejects.toThrow();
  });
});

describe("backup file names", () => {
  it("embeds the timestamp and counts in the path", () => {
    const data = doc({
      contacts: [{ id: "c1" }] as unknown as AppData["contacts"],
      folders: [{ id: "f1" }] as unknown as AppData["folders"],
    });
    const path = backupPath("default", data, AT);
    expect(path).toBe("backups/contacts-default-2026-07-04T11-45-26-c1-f1.zip");
  });

  it("derives a clean display name without slug or counts", () => {
    expect(backupFileName(AT)).toBe("contacts-2026-07-04T11-45-26.zip");
  });

  it("formats the browse-list date as YYYY-MM-DD HH:MM", () => {
    expect(formatBackupDate(AT)).toBe("2026-07-04 11:45");
  });
});

describe("parseBackups", () => {
  const paths = [
    "backups/contacts-default-2026-07-04T11-45-26-c352-f3.zip",
    "backups/contacts-default-2026-06-19T22-33-37-c313-f3.zip",
    "backups/contacts-work-2026-06-01T09-00-00-c10-f1.zip", // other namespace
    "photos/ada.jpg", // unrelated file
    "backups/contacts-default-legacy.zip", // non-matching name
  ];

  it("keeps only the current namespace's backups, newest first", () => {
    const list = parseBackups(paths, "default");
    expect(list).toHaveLength(2);
    expect(list[0]!.date.getTime()).toBeGreaterThan(list[1]!.date.getTime());
    expect(list[0]!.contacts).toBe(352);
    expect(list[0]!.folders).toBe(3);
  });

  it("recovers a clean display name for a parsed backup", () => {
    const [latest] = parseBackups(paths, "default");
    expect(backupDisplayName(latest!)).toBe("contacts-2026-07-04T11-45-26.zip");
  });

  it("tolerates a slug containing dashes", () => {
    const list = parseBackups(
      ["backups/contacts-my-team-2026-07-04T11-45-26-c5-f2.zip"],
      "my-team",
    );
    expect(list).toHaveLength(1);
    expect(list[0]!.contacts).toBe(5);
  });

  it("accepts a countless name (nulls the counts)", () => {
    const list = parseBackups(
      ["backups/contacts-default-2026-07-04T11-45-26.zip"],
      "default",
    );
    expect(list).toHaveLength(1);
    expect(list[0]!.contacts).toBeNull();
    expect(list[0]!.folders).toBeNull();
  });
});
