// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The list view's grouping model. The overview screen (`ContactListScreen`)
// lays every active contact out under the folder it belongs to; this module is
// the pure shape behind that — which folders show, and which contacts sit in
// each — kept out of the component so it is unit-testable in node (see
// `tests/contactList_test.ts`). It reads the same "archived things drop out of
// the view but stay in the document" rule the side menu follows.

import type { ListPhonePriority } from "./useAppSettings.ts";
import type { AppData, Contact, Folder, Phone } from "./types.ts";
import { compareContacts, methodKind } from "./types.ts";

/** One folder's worth of the list view: the folder heading (or `null` for the
 *  ungrouped contacts shown at the root), and the active contacts it holds,
 *  already in display order. */
export type ContactGroup = {
  /** The folder this group heads, or `null` for the ungrouped root group. */
  folder: Folder | null;
  contacts: Contact[];
};

/** Options narrowing which active contacts the overview groups. Defaults to
 *  every active card; `favoritesOnly` keeps just the starred ones — the
 *  Favorites page is the same folder-grouped layout over that shortlist. */
export type GroupOptions = {
  /** When set, keep only contacts flagged `favorite`. */
  favoritesOnly?: boolean;
};

/** Group a document's active contacts by folder for the overview screen.
 *  Non-archived folders come first in document order, then the ungrouped
 *  contacts as a trailing `null` group — each group shown only when it holds
 *  at least one active contact, so empty folders drop out of the list.
 *  Archived folders and archived contacts are left out; contacts within each
 *  group are sorted by display name (nameless last), the same order the side
 *  menu uses. With `favoritesOnly`, only starred contacts are kept — so a
 *  folder with no favorites drops out just as an empty one does, and the
 *  Favorites page reuses this whole shape. */
export function groupContactsByFolder(
  data: AppData,
  opts: GroupOptions = {},
): ContactGroup[] {
  const keep = (c: Contact) =>
    !c.archived && (!opts.favoritesOnly || !!c.favorite);
  const groups: ContactGroup[] = [];
  for (const folder of data.folders.filter((f) => !f.archived)) {
    const contacts = data.contacts
      .filter((c) => c.folderId === folder.id && keep(c))
      .sort(compareContacts);
    if (contacts.length > 0) groups.push({ folder, contacts });
  }
  const standalone = data.contacts
    .filter((c) => c.folderId === null && keep(c))
    .sort(compareContacts);
  if (standalone.length > 0)
    groups.push({ folder: null, contacts: standalone });
  return groups;
}

/** Every active contact the overview screen shows, flattened in the same order
 *  the groups render — the corpus a "select all" acts over. */
export function listedContacts(groups: readonly ContactGroup[]): Contact[] {
  return groups.flatMap((g) => g.contacts);
}

/** The Favorites page's shortlist: every active, starred contact as one flat
 *  list in the user's hand-picked order (see `favoriteOrder`). A card that has
 *  been placed sorts by its saved position; one that never has sorts after the
 *  placed cards, by display name — so a brand-new favorite lands at the bottom
 *  until it's dragged into place. Unlike the folder-grouped List, favorites are
 *  a single ordered list so they can be reordered freely across folders. */
export function favoriteContacts(data: AppData): Contact[] {
  return data.contacts
    .filter((c) => !c.archived && c.favorite)
    .sort((a, b) => {
      const ao = a.favoriteOrder ?? Number.POSITIVE_INFINITY;
      const bo = b.favoriteOrder ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return compareContacts(a, b);
    });
}

/** Move `dragId` to sit where `targetId` is, returning the reordered id list —
 *  the drop behind a Favorites drag-to-reorder gesture. The dragged id is
 *  lifted out and re-inserted at the target's position, so dropping a card onto
 *  one above it lands it above, and onto one below lands it below. A no-op
 *  (same list) when either id is missing or they're the same. */
export function reorderIds(
  ids: readonly string[],
  dragId: string,
  targetId: string,
): string[] {
  if (dragId === targetId) return [...ids];
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1) return [...ids];
  const next = ids.filter((id) => id !== dragId);
  next.splice(to, 0, dragId);
  return next;
}

/** Every non-archived contact flagged **in case of emergency**, in display
 *  order — the pinned list the side menu floats to the very top so an
 *  emergency contact is reachable at a glance, no matter which folder it's
 *  filed in. An ICE card inside an archived folder inherits that folder's
 *  archived flag, so it drops out here the same way it drops out of the menu. */
export function emergencyContacts(data: AppData): Contact[] {
  return data.contacts
    .filter((c) => c.ice && !c.archived)
    .sort(compareContacts);
}

/** The phone numbers the List view shows for a contact under the chosen
 *  priority. `both` keeps every number; `private` / `work` keep just that kind
 *  — but when the contact has none of the preferred kind the whole set is
 *  returned rather than nothing, so a row never goes blank when a number exists.
 *  The caller has already dropped empty values. */
export function prioritizePhones(
  phones: readonly Phone[],
  priority: ListPhonePriority,
): Phone[] {
  if (priority === "both") return [...phones];
  const preferred = phones.filter((p) => methodKind(p.label) === priority);
  return preferred.length > 0 ? preferred : [...phones];
}
