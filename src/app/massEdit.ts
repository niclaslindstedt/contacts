// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Editing many cards at once — the patch behind select mode's "Edit selected"
// modal. A single {@link MassEdit} describes the changes the user picked (tags
// to add, a relationship to set, a card type to switch to); this turns it into
// the per-contact patch that applies it, kept pure so the fold rules are
// testable on their own and the store just maps them over the ticked set.
//
// Every field is *opt-in*: an absent key on the edit means "leave this alone",
// so a mass edit only touches the facets the user actually chose. A card the
// edit wouldn't change at all yields `null`, so the store can leave it — and
// its `updatedAt` stamp — untouched and skip the commit when nothing moves.

import { companyTogglePatch } from "./companyCard.ts";
import { withTagAdded } from "./tags.ts";
import type { Contact } from "./types.ts";

/** The bulk change select mode's edit modal applies to every ticked card. Each
 *  facet is optional — an omitted one is left as-is on every contact. */
export type MassEdit = {
  /** Tags to add to each card, folded on with the same case-insensitive dedupe
   *  the single-card tag field uses (a tag a card already carries is skipped). */
  addTags?: string[];
  /** The relationship to set on every card — a built-in key, a custom label, or
   *  the empty string to clear it. Absent leaves each card's relationship be. */
  relation?: string;
  /** The card type to switch every card to: `true` makes each a company card,
   *  `false` a person card. Absent leaves the type be. Flipping to a company
   *  drops the person-only fields for real (see {@link companyTogglePatch}),
   *  just as the single-card switch does. */
  isCompany?: boolean;
};

/** Whether a mass edit carries any change at all — the modal's Apply button is
 *  inert until it does, so an empty edit never reaches the store. */
export function isEmptyMassEdit(edit: MassEdit): boolean {
  return (
    (edit.addTags === undefined || edit.addTags.length === 0) &&
    edit.relation === undefined &&
    edit.isCompany === undefined
  );
}

/** The patch that applies a {@link MassEdit} to one card, or `null` when the
 *  edit would leave this card unchanged (already the target type, already
 *  carrying every added tag, already at that relationship). The card-type
 *  switch runs first so a person→company flip's field-clearing is in place
 *  before the relationship and tags — which a company keeps — land on top. */
export function massEditPatch(
  contact: Contact,
  edit: MassEdit,
): Partial<Contact> | null {
  let patch: Partial<Contact> = {};
  let changed = false;

  // Card type — only when it actually flips, so a card already of the wanted
  // type is never needlessly reconverted (which, for a person→company card,
  // would re-clear its name / birthday even though nothing asked it to).
  if (edit.isCompany !== undefined && !!contact.isCompany !== edit.isCompany) {
    patch = { ...patch, ...companyTogglePatch(contact, edit.isCompany) };
    changed = true;
  }

  // Relationship — set the single value (or clear it with an empty string).
  if (edit.relation !== undefined) {
    const next = edit.relation || undefined;
    if ((contact.relation ?? undefined) !== next) {
      patch.relation = next;
      changed = true;
    }
  }

  // Tags — fold each added tag onto the card's list, skipping ones it already
  // has. `withTagAdded` returns the same reference when nothing is added, so a
  // card that already carries every tag contributes no change.
  if (edit.addTags && edit.addTags.length > 0) {
    let tags: string[] = contact.tags ?? [];
    let tagsChanged = false;
    for (const raw of edit.addTags) {
      const next = withTagAdded(tags, raw);
      if (next !== tags) {
        tags = next;
        tagsChanged = true;
      }
    }
    if (tagsChanged) {
      patch.tags = tags;
      changed = true;
    }
  }

  return changed ? patch : null;
}
