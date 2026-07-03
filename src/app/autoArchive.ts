// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The auto-archive maths. A contact can be given a date on which it files
// itself away — either shelved into the Archive or deleted outright (see the
// `autoArchiveDate` / `autoArchiveAction` fields in `types.ts`). Think of the
// pizzeria you add for a week's holiday and want gone when you're home again.
//
// This module is the pure seam over that: given a set of contacts and today's
// date, decide which are due and split them into the ones to archive and the
// ones to delete. Everything takes the reference date as an argument (an ISO
// `YYYY-MM-DD` string), so the whole surface is deterministic and unit-testable
// in node (see `tests/autoArchive_test.ts`); `useContactStore` calls it with
// the real clock and applies the outcome as one undoable step.

import { parseFlexDate } from "./importantDates.ts";
import type { AutoArchiveAction, Contact } from "./types.ts";

const MS_PER_DAY = 86_400_000;

/** Today's local date as an ISO `YYYY-MM-DD` string — the reference the sweep
 *  compares scheduled dates against. Local (not UTC) so "today" matches the
 *  day the user sees on their own calendar. */
export function isoDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A sensible default when the user first switches auto-archiving on: two weeks
 *  out, so the card doesn't vanish the moment they enable it. Returned as an
 *  ISO `YYYY-MM-DD` the date input can show and the sweep can compare. */
export function defaultAutoArchiveDate(now: Date): string {
  return isoDate(new Date(now.getTime() + 14 * MS_PER_DAY));
}

/** The action a due contact resolves to — its stored one, defaulting to
 *  archiving when a date was set without picking an action. */
export function autoArchiveAction(contact: Contact): AutoArchiveAction {
  return contact.autoArchiveAction === "delete" ? "delete" : "archive";
}

/** True when the contact carries a valid, full-ISO auto-archive date that has
 *  arrived (falls on or before `today`). A missing, partial, or invalid date
 *  is never due, so a half-typed value in the editor can't trip the sweep. */
export function isAutoArchiveDue(contact: Contact, today: string): boolean {
  const date = contact.autoArchiveDate?.trim();
  if (!date) return false;
  // Reject anything that isn't a real full date (a bare MM-DD parses with a
  // null year — not a schedulable auto-archive date).
  const parsed = parseFlexDate(date);
  if (!parsed || parsed.y === null) return false;
  // Both sides are zero-padded ISO dates, so a lexical compare is a date
  // compare.
  return date <= today;
}

/** The contacts a sweep on `today` acts on, split by outcome. A due delete is
 *  removed whatever its archived state; a due archive is shelved only when it
 *  isn't already archived (an already-shelved card is left untouched, its
 *  lingering date harmless). Contacts with no schedule, a future date, or a
 *  malformed date are left out of both lists. */
export function dueContacts(
  contacts: readonly Contact[],
  today: string,
): { toArchive: Contact[]; toDelete: Contact[] } {
  const toArchive: Contact[] = [];
  const toDelete: Contact[] = [];
  for (const contact of contacts) {
    if (!isAutoArchiveDue(contact, today)) continue;
    if (autoArchiveAction(contact) === "delete") {
      toDelete.push(contact);
    } else if (!contact.archived) {
      toArchive.push(contact);
    }
  }
  return { toArchive, toDelete };
}
