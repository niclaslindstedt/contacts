// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The foot-of-card "Added … / Modified …" date stamp, kept as a pure function
// over the contact's stored timestamps so it's unit-testable in node (see
// `tests/contactTimestamps_test.ts`). The store stamps `createdAt` once when a
// card is created and refreshes `updatedAt` on every edit (see
// `useContactStore`); this module only decides what the read view shows.

import { formatDate, type DateFormat } from "./format.ts";
import type { Contact } from "./types.ts";

/** Pull the `YYYY-MM-DD` date part out of a stored ISO timestamp, or null when
 *  the value is absent or not a recognisable timestamp. */
function isoDatePart(ts: string | undefined): string | null {
  if (!ts) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(ts.trim());
  return m ? m[1]! : null;
}

/** The two dates the read view's foot-of-card stamp renders, each already
 *  formatted in the chosen {@link DateFormat}:
 *
 *  - `added` — the day the card was first added, or null when it carries no
 *    `createdAt` (a card from before the timestamp field, not yet migrated, or
 *    a dev-seed card).
 *  - `modified` — the day it was last edited, shown only when the card has been
 *    touched since creation *and* that edit lands on a different calendar day.
 *    A never-edited card (no `updatedAt`) and a same-day edit both leave this
 *    null, so the stamp never repeats a date it already shows as "Added". */
export function contactStamp(
  contact: Pick<Contact, "createdAt" | "updatedAt">,
  format: DateFormat,
): { added: string | null; modified: string | null } {
  const createdDate = isoDatePart(contact.createdAt);
  const updatedDate = isoDatePart(contact.updatedAt);
  return {
    added: createdDate ? formatDate(createdDate, format) : null,
    modified:
      updatedDate && updatedDate !== createdDate
        ? formatDate(updatedDate, format)
        : null,
  };
}
