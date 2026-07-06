// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { mergeInlineMedia } from "../src/app/mediaHydrate.ts";
import type { AppData, Contact } from "../src/app/types.ts";

// The additive media merge that restores a contact's photo / attachment bytes
// after the local working copy has shed them to the storage quota (keeping the
// entries and their cloud paths). It fills only what the working copy is
// missing, only on entries it still has — never overwriting a local byte and
// never resurrecting an entry the backend has but the working copy doesn't.

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

describe("mergeInlineMedia — photos", () => {
  it("fills a stripped photo's bytes from the backend copy", () => {
    const current = doc([
      contact({ photos: [{ id: "p1", photoPath: "photos/ada-c1-p1.jpg" }] }),
    ]);
    const remote = doc([
      contact({
        photos: [
          {
            id: "p1",
            photo: "data:image/jpeg;base64,AAAA",
            photoPath: "photos/ada-c1-p1.jpg",
          },
        ],
      }),
    ]);
    const merged = mergeInlineMedia(current, remote);
    expect(merged).not.toBeNull();
    expect(merged!.contacts[0]!.photos![0]!.photo).toBe(
      "data:image/jpeg;base64,AAAA",
    );
  });

  it("fills a bare entry's path and source too, matching by id", () => {
    const current = doc([contact({ photos: [{ id: "p1" }] })]);
    const remote = doc([
      contact({
        photos: [
          {
            id: "p1",
            photo: "data:image/jpeg;base64,CROP",
            photoSource: "data:image/jpeg;base64,SRC",
            photoPath: "photos/ada-c1-p1.jpg",
            photoSourcePath: "photos/ada-c1-p1-source.jpg",
          },
        ],
      }),
    ]);
    const p = mergeInlineMedia(current, remote)!.contacts[0]!.photos![0]!;
    expect(p.photo).toBe("data:image/jpeg;base64,CROP");
    expect(p.photoSource).toBe("data:image/jpeg;base64,SRC");
    expect(p.photoPath).toBe("photos/ada-c1-p1.jpg");
    expect(p.photoSourcePath).toBe("photos/ada-c1-p1-source.jpg");
  });

  it("never overwrites a photo the working copy already holds", () => {
    const current = doc([
      contact({
        photos: [{ id: "p1", photo: "data:image/jpeg;base64,LOCAL" }],
      }),
    ]);
    const remote = doc([
      contact({ photos: [{ id: "p1", photo: "data:image/jpeg;base64,OLD" }] }),
    ]);
    expect(mergeInlineMedia(current, remote)).toBeNull();
  });

  it("returns null when nothing is missing", () => {
    const current = doc([
      contact({ photos: [{ id: "p1", photo: "data:image/jpeg;base64,AAAA" }] }),
    ]);
    expect(mergeInlineMedia(current, structuredClone(current))).toBeNull();
  });

  it("ignores a backend entry the working copy no longer has", () => {
    // A photo deleted locally (and not yet synced) must not come back.
    const current = doc([contact({ photos: [] })]);
    const remote = doc([
      contact({ photos: [{ id: "p1", photo: "data:image/jpeg;base64,GONE" }] }),
    ]);
    expect(mergeInlineMedia(current, remote)).toBeNull();
  });

  it("ignores a backend contact the working copy doesn't have", () => {
    const current = doc([contact({ id: "c1", photos: [{ id: "p1" }] })]);
    const remote = doc([
      contact({
        id: "c2",
        photos: [{ id: "p1", photo: "data:image/jpeg;base64,OTHER" }],
      }),
    ]);
    expect(mergeInlineMedia(current, remote)).toBeNull();
  });

  it("leaves other contacts untouched and only rewrites what changed", () => {
    const untouched = contact({ id: "c2", firstName: "Grace" });
    const current = doc([
      contact({ photos: [{ id: "p1", photoPath: "photos/ada-c1-p1.jpg" }] }),
      untouched,
    ]);
    const remote = doc([
      contact({
        photos: [
          {
            id: "p1",
            photo: "data:image/jpeg;base64,AAAA",
            photoPath: "photos/ada-c1-p1.jpg",
          },
        ],
      }),
      contact({ id: "c2", firstName: "Grace" }),
    ]);
    const merged = mergeInlineMedia(current, remote)!;
    expect(merged.contacts[1]).toBe(untouched); // same reference, no rewrite
    expect(merged.contacts[0]!.photos![0]!.photo).toBe(
      "data:image/jpeg;base64,AAAA",
    );
  });
});

describe("mergeInlineMedia — attachments", () => {
  it("fills a stripped attachment's bytes and path", () => {
    const current = doc([
      contact({
        attachments: [{ id: "a1", name: "menu.pdf", mime: "application/pdf" }],
      }),
    ]);
    const remote = doc([
      contact({
        attachments: [
          {
            id: "a1",
            name: "menu.pdf",
            mime: "application/pdf",
            data: "data:application/pdf;base64,PDF",
            dataPath: "attachments/menu-c1-a1.pdf",
          },
        ],
      }),
    ]);
    const a = mergeInlineMedia(current, remote)!.contacts[0]!.attachments![0]!;
    expect(a.data).toBe("data:application/pdf;base64,PDF");
    expect(a.dataPath).toBe("attachments/menu-c1-a1.pdf");
  });

  it("keeps an attachment's local bytes over the backend's", () => {
    const current = doc([
      contact({
        attachments: [
          {
            id: "a1",
            name: "menu.pdf",
            mime: "application/pdf",
            data: "data:application/pdf;base64,LOCAL",
          },
        ],
      }),
    ]);
    const remote = doc([
      contact({
        attachments: [
          {
            id: "a1",
            name: "menu.pdf",
            mime: "application/pdf",
            data: "data:application/pdf;base64,OLD",
          },
        ],
      }),
    ]);
    expect(mergeInlineMedia(current, remote)).toBeNull();
  });
});
