// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The "primary phone" rule — which of a contact's several numbers is the one to
// reach them on. A card may flag exactly one number as primary (see
// `Phone.primary`); the Favorites page then shows only that number instead of
// the whole list, so a starred contact reads as a single tap-to-call. The flag
// lives on the phone row itself, so it travels with the number and is dropped
// for free when that number is removed.
//
// These two helpers keep the "exactly one primary" invariant in one place:
// reading tolerates a document with none — or, defensively, several — flagged,
// and the setter clears the flag off every other row so only one ever carries
// it. Both are pure (the setter returns the rewritten rows for the caller to
// commit as one `phones` patch), so they're node-testable and a primary change
// is one undoable store step like any other phone edit.

import type { Phone } from "./types.ts";

/** The contact's primary phone: the first non-empty row flagged `primary`, or
 *  `undefined` when none is (no flag, or the flagged row has no value). Reading
 *  is defensive — a hand-edited or imported document that somehow carries the
 *  flag on several rows resolves to the first, never throwing the invariant. */
export function primaryPhone(phones: readonly Phone[]): Phone | undefined {
  return phones.find((p) => p.primary && p.value.trim());
}

/** Flag the row `id` as the contact's primary, clearing the flag off every
 *  other row; pass `null` (or the id of the row already primary, so the caller
 *  can treat a tap as a toggle) to clear it entirely. Returns the rewritten
 *  rows — the caller commits them as one `phones` patch. The cleared flag is
 *  dropped from the row rather than set to `false`, keeping the stored document
 *  tidy the way an absent `countryCode` does. */
export function withPrimaryPhone(
  phones: readonly Phone[],
  id: string | null,
): Phone[] {
  return phones.map((p) => {
    if (id !== null && p.id === id) return { ...p, primary: true };
    if (!p.primary) return p;
    // Drop the flag key rather than store `primary: false`, keeping the document
    // tidy the way an absent `countryCode` does.
    const rest = { ...p };
    delete rest.primary;
    return rest;
  });
}
