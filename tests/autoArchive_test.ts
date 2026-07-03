// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  autoArchiveAction,
  defaultAutoArchiveDate,
  dueContacts,
  isAutoArchiveDue,
  isoDate,
} from "../src/app/autoArchive.ts";
import type { Contact } from "../src/app/types.ts";

// A minimal contact with just the fields the auto-archive logic reads — the
// rest of the card shape is irrelevant to the sweep.
function contact(patch: Partial<Contact>): Contact {
  return {
    id: patch.id ?? "c1",
    firstName: "Test",
    lastName: "Contact",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
    ...patch,
  };
}

describe("isoDate", () => {
  it("formats a local date as zero-padded YYYY-MM-DD", () => {
    expect(isoDate(new Date(2026, 6, 3))).toBe("2026-07-03");
    expect(isoDate(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});

describe("defaultAutoArchiveDate", () => {
  it("lands two weeks past the reference date", () => {
    expect(defaultAutoArchiveDate(new Date(2026, 6, 3))).toBe("2026-07-17");
  });

  it("carries across a month boundary", () => {
    expect(defaultAutoArchiveDate(new Date(2026, 6, 25))).toBe("2026-08-08");
  });
});

describe("autoArchiveAction", () => {
  it("defaults to archiving when no action is stored", () => {
    expect(autoArchiveAction(contact({ autoArchiveDate: "2026-01-01" }))).toBe(
      "archive",
    );
  });

  it("reads a stored delete action", () => {
    expect(
      autoArchiveAction(
        contact({ autoArchiveDate: "2026-01-01", autoArchiveAction: "delete" }),
      ),
    ).toBe("delete");
  });
});

describe("isAutoArchiveDue", () => {
  const today = "2026-07-03";

  it("is due on the scheduled day", () => {
    expect(isAutoArchiveDue(contact({ autoArchiveDate: today }), today)).toBe(
      true,
    );
  });

  it("is due when the scheduled day has passed", () => {
    expect(
      isAutoArchiveDue(contact({ autoArchiveDate: "2026-06-01" }), today),
    ).toBe(true);
  });

  it("is not due for a future date", () => {
    expect(
      isAutoArchiveDue(contact({ autoArchiveDate: "2026-08-01" }), today),
    ).toBe(false);
  });

  it("is never due with no schedule", () => {
    expect(isAutoArchiveDue(contact({}), today)).toBe(false);
    expect(isAutoArchiveDue(contact({ autoArchiveDate: "  " }), today)).toBe(
      false,
    );
  });

  it("ignores a malformed or yearless date so a half-typed value can't fire", () => {
    expect(
      isAutoArchiveDue(contact({ autoArchiveDate: "2026-13-40" }), today),
    ).toBe(false);
    expect(isAutoArchiveDue(contact({ autoArchiveDate: "07-03" }), today)).toBe(
      false,
    );
    expect(
      isAutoArchiveDue(contact({ autoArchiveDate: "2026-07" }), today),
    ).toBe(false);
  });
});

describe("dueContacts", () => {
  const today = "2026-07-03";

  it("routes a due card by its action", () => {
    const toArchive = contact({ id: "a", autoArchiveDate: "2026-07-01" });
    const toDelete = contact({
      id: "b",
      autoArchiveDate: "2026-07-01",
      autoArchiveAction: "delete",
    });
    const future = contact({ id: "c", autoArchiveDate: "2027-01-01" });
    const none = contact({ id: "d" });

    const result = dueContacts([toArchive, toDelete, future, none], today);
    expect(result.toArchive.map((c) => c.id)).toEqual(["a"]);
    expect(result.toDelete.map((c) => c.id)).toEqual(["b"]);
  });

  it("skips a due archive that is already archived (a no-op)", () => {
    const already = contact({
      id: "a",
      autoArchiveDate: "2026-07-01",
      archived: true,
    });
    const result = dueContacts([already], today);
    expect(result.toArchive).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);
  });

  it("still deletes a due delete-scheduled card even if it was archived first", () => {
    const already = contact({
      id: "a",
      autoArchiveDate: "2026-07-01",
      autoArchiveAction: "delete",
      archived: true,
    });
    const result = dueContacts([already], today);
    expect(result.toDelete.map((c) => c.id)).toEqual(["a"]);
  });

  it("returns empty lists when nothing is due", () => {
    const result = dueContacts(
      [contact({ autoArchiveDate: "2099-01-01" }), contact({})],
      today,
    );
    expect(result.toArchive).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);
  });
});
