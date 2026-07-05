// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { contactStamp } from "../src/app/contactTimestamps.ts";

describe("contactStamp", () => {
  it("formats the added date in the chosen date format", () => {
    expect(
      contactStamp({ createdAt: "2025-07-27T10:30:00.000Z" }, "iso"),
    ).toEqual({ added: "2025-07-27", modified: null });
    expect(
      contactStamp({ createdAt: "2025-07-27T10:30:00.000Z" }, "eu"),
    ).toEqual({ added: "27/07/2025", modified: null });
  });

  it("shows the modified date once a card is edited on a later day", () => {
    expect(
      contactStamp(
        {
          createdAt: "2025-07-27T10:30:00.000Z",
          updatedAt: "2025-08-21T09:00:00.000Z",
        },
        "iso",
      ),
    ).toEqual({ added: "2025-07-27", modified: "2025-08-21" });
  });

  it("omits the modified date for a same-day edit — a date stamp gains nothing from repeating it", () => {
    expect(
      contactStamp(
        {
          createdAt: "2025-07-27T10:30:00.000Z",
          updatedAt: "2025-07-27T18:45:00.000Z",
        },
        "iso",
      ),
    ).toEqual({ added: "2025-07-27", modified: null });
  });

  it("has no added date when the card carries no createdAt", () => {
    expect(contactStamp({}, "iso")).toEqual({ added: null, modified: null });
    // updatedAt without createdAt still yields no stamp — nothing to anchor.
    expect(
      contactStamp({ updatedAt: "2025-08-21T09:00:00.000Z" }, "iso"),
    ).toEqual({ added: null, modified: "2025-08-21" });
  });

  it("ignores an unparseable timestamp", () => {
    expect(contactStamp({ createdAt: "not-a-date" }, "iso")).toEqual({
      added: null,
      modified: null,
    });
  });
});
