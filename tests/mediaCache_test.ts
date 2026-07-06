// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  desiredMedia,
  mediaKey,
  recordsToMediaSource,
  type MediaRecord,
} from "../src/app/mediaCache.ts";
import { mergeInlineMedia } from "../src/app/mediaHydrate.ts";
import type { AppData, Contact } from "../src/app/types.ts";

// The node-testable half of the on-device media cache: the stable key, the
// derivation of the records a document wants cached, and folding cached records
// back into a merge source. The IndexedDB I/O itself is browser-only.

function contact(over: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
    ...over,
  };
}

function doc(contacts: Contact[]): AppData {
  return { folders: [], contacts, activeContactId: contacts[0]?.id ?? "" };
}

describe("mediaKey", () => {
  it("is stable and distinguishes contact / entry / kind / namespace", () => {
    expect(mediaKey("default", "c1", "p1", "photo")).toBe(
      mediaKey("default", "c1", "p1", "photo"),
    );
    expect(mediaKey("default", "c1", "p1", "photo")).not.toBe(
      mediaKey("default", "c1", "p1", "photoSource"),
    );
    expect(mediaKey("default", "c1", "p1", "photo")).not.toBe(
      mediaKey("work", "c1", "p1", "photo"),
    );
    expect(mediaKey("default", "c1", "p1", "photo")).not.toBe(
      mediaKey("default", "c2", "p1", "photo"),
    );
  });
});

describe("desiredMedia", () => {
  it("emits a record per inline photo / source / attachment byte field", () => {
    const data = doc([
      contact({
        photos: [
          { id: "p1", photo: "data:,A", photoSource: "data:,B" },
          { id: "p2", photo: "data:,C" },
        ],
        attachments: [
          { id: "a1", name: "m.pdf", mime: "application/pdf", data: "data:,D" },
        ],
      }),
    ]);
    const records = desiredMedia("default", data);
    expect(records.map((r) => [r.entryId, r.kind, r.data])).toEqual([
      ["p1", "photo", "data:,A"],
      ["p1", "photoSource", "data:,B"],
      ["p2", "photo", "data:,C"],
      ["a1", "attachment", "data:,D"],
    ]);
    expect(records[0]!.key).toBe(mediaKey("default", "c1", "p1", "photo"));
  });

  it("skips entries that carry only a path (no inline bytes)", () => {
    const data = doc([
      contact({
        photos: [{ id: "p1", photoPath: "photos/x.jpg" }],
        attachments: [
          { id: "a1", name: "m.pdf", mime: "application/pdf", dataPath: "x" },
        ],
      }),
    ]);
    expect(desiredMedia("default", data)).toEqual([]);
  });
});

describe("recordsToMediaSource → mergeInlineMedia", () => {
  it("re-hydrates a stripped working copy from cached records", () => {
    const records: MediaRecord[] = [
      {
        key: mediaKey("default", "c1", "p1", "photo"),
        slug: "default",
        contactId: "c1",
        entryId: "p1",
        kind: "photo",
        data: "data:,CROP",
      },
      {
        key: mediaKey("default", "c1", "p1", "photoSource"),
        slug: "default",
        contactId: "c1",
        entryId: "p1",
        kind: "photoSource",
        data: "data:,SRC",
      },
      {
        key: mediaKey("default", "c1", "a1", "attachment"),
        slug: "default",
        contactId: "c1",
        entryId: "a1",
        kind: "attachment",
        data: "data:,FILE",
      },
    ];
    // A working copy that kept the entries but shed the bytes.
    const current = doc([
      contact({
        photos: [{ id: "p1", photoPath: "photos/x.jpg" }],
        attachments: [{ id: "a1", name: "m.pdf", mime: "application/pdf" }],
      }),
    ]);
    const merged = mergeInlineMedia(current, recordsToMediaSource(records))!;
    const c = merged.contacts[0]!;
    expect(c.photos![0]!.photo).toBe("data:,CROP");
    expect(c.photos![0]!.photoSource).toBe("data:,SRC");
    // The pre-existing path is untouched — the merge only fills what's missing.
    expect(c.photos![0]!.photoPath).toBe("photos/x.jpg");
    expect(c.attachments![0]!.data).toBe("data:,FILE");
  });

  it("groups a contact's photo and source records onto one entry", () => {
    const src = recordsToMediaSource([
      {
        key: "k1",
        slug: "default",
        contactId: "c1",
        entryId: "p1",
        kind: "photo",
        data: "data:,A",
      },
      {
        key: "k2",
        slug: "default",
        contactId: "c1",
        entryId: "p1",
        kind: "photoSource",
        data: "data:,B",
      },
    ]);
    expect(src.contacts).toHaveLength(1);
    expect(src.contacts[0]!.photos).toEqual([
      { id: "p1", photo: "data:,A", photoSource: "data:,B" },
    ]);
  });
});
