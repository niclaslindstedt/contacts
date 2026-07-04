// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { docKey, localDocBackend } from "../src/app/useContactStore.ts";
import { LATEST_VERSION, serializeDoc } from "../src/app/migrations.ts";
import type { AppData } from "../src/app/types.ts";

// A minimal in-memory stand-in for `localStorage` that can be told to reject
// writes above a byte budget — so the quota fallbacks are exercisable in node.
class FakeStorage {
  private map = new Map<string, string>();
  /** Reject any single value longer than this many chars (0 = no limit). */
  maxValueLen = 0;
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    if (this.maxValueLen > 0 && value.length > this.maxValueLen) {
      const err = new Error("quota exceeded");
      err.name = "QuotaExceededError";
      throw err;
    }
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const SLUG = "work";
const KEY = docKey(SLUG);

function docWithPhoto(): AppData {
  return {
    folders: [],
    contacts: [
      {
        id: "c1",
        firstName: "Ada",
        lastName: "Lovelace",
        phones: [{ id: "p1", value: "+46701234567" }],
        emails: [],
        addresses: [],
        importantDates: [],
        folderId: null,
        // A chunky inline photo — the kind of payload that overflows the
        // localStorage quota on the local copy while the cloud copy keeps it
        // filed out as a separate binary.
        photos: [
          { id: "ph1", photo: "data:image/jpeg;base64," + "A".repeat(4000) },
        ],
      },
    ],
    activeContactId: "c1",
  };
}

let store: FakeStorage;

beforeEach(() => {
  store = new FakeStorage();
  (globalThis as { localStorage?: Storage }).localStorage =
    store as unknown as Storage;
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("localDocBackend.load", () => {
  it("returns a starter document when nothing is stored", () => {
    const doc = localDocBackend.load(SLUG);
    expect(doc.contacts).toHaveLength(1);
    expect(doc.contacts[0]!.firstName).toBe("");
  });

  it("parses and migrates stored bytes", () => {
    store.setItem(KEY, serializeDoc(docWithPhoto()));
    const doc = localDocBackend.load(SLUG);
    expect(doc.contacts[0]!.firstName).toBe("Ada");
  });

  it("preserves the stored copy when the bytes can't be read", () => {
    // A document written by a newer build — the migrator refuses it. This must
    // NOT wipe the on-disk copy; it is left intact and quarantined.
    const future = JSON.stringify({
      version: LATEST_VERSION + 5,
      folders: [],
      contacts: [{ id: "c1", firstName: "Grace", lastName: "Hopper" }],
      activeContactId: "c1",
    });
    store.setItem(KEY, future);

    const doc = localDocBackend.load(SLUG);

    // The caller gets a blank starter to render, but the real bytes survive.
    expect(doc.contacts[0]!.firstName).toBe("");
    expect(store.getItem(KEY)).toBe(future);
    expect(store.getItem(`${KEY}:unreadable`)).toBe(future);
  });
});

describe("localDocBackend.save", () => {
  it("persists the full document when it fits", () => {
    localDocBackend.save(SLUG, docWithPhoto());
    const stored = JSON.parse(store.getItem(KEY)!);
    expect(stored.contacts[0]!.photos[0].photo).toContain("base64");
  });

  it("falls back to a slimmed copy when the full document won't fit", () => {
    // Budget sits below the photo-laden document but above the slimmed one, so
    // the full write throws and the retry (media stripped) succeeds.
    store.maxValueLen = 2000;
    localDocBackend.save(SLUG, docWithPhoto());

    const stored = JSON.parse(store.getItem(KEY)!);
    // The contact — the thing the user cares about — survives...
    expect(stored.contacts[0]!.firstName).toBe("Ada");
    expect(stored.contacts[0]!.phones[0].value).toBe("+46701234567");
    // ...with only the heavy inline photo bytes shed.
    expect(stored.contacts[0]!.photos[0].photo).toBeUndefined();
  });
});
