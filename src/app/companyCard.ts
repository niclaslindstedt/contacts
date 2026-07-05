// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Flipping a card between person and company — the patch behind the edit
// view's "Company contact" switch, kept pure so the conversion rules are
// testable on their own.

import type { Contact } from "./types.ts";

/** The store patch that flips a card between person and company.
 *
 *  Turning it **on** converts the card for real rather than just relabelling
 *  it: the person-only fields the company edit view hides — the first/last
 *  name split, the birthday, the extra important dates, and the
 *  in-case-of-emergency flag — are **dropped from the card**, not merely
 *  hidden. Hidden-but-kept values would go on leaking: `displayName` prefers
 *  the name split over the company name (so the side menu and the vCard `FN`
 *  would still title the card with the person), and the read view and export
 *  would still show a birthday no company has. When the company name is still
 *  blank, whatever name the card already had is promoted into the company
 *  field first, so a "Jane's Café" typed as a person isn't lost.
 *
 *  Turning it **off** just drops the company flag; the company text stays put
 *  and the person fields start blank. The person data cleared by the earlier
 *  conversion isn't resurrected — undo is the way back from a mistaken flip,
 *  since the whole conversion commits as one undoable step. */
export function companyTogglePatch(
  contact: Contact,
  on: boolean,
): Partial<Contact> {
  if (!on) return { isCompany: false };
  const patch: Partial<Contact> = {
    isCompany: true,
    firstName: "",
    lastName: "",
    birthday: undefined,
    importantDates: [],
    ice: false,
  };
  const name = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!contact.company?.trim() && name) patch.company = name;
  return patch;
}
