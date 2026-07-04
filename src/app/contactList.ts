// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The list view's grouping model. The overview screen (`ContactListScreen`)
// lays every active contact out under the folder it belongs to; this module is
// the pure shape behind that — which folders show, and which contacts sit in
// each — kept out of the component so it is unit-testable in node (see
// `tests/contactList_test.ts`). It reads the same "archived things drop out of
// the view but stay in the document" rule the side menu follows.

import type { AppData, Contact, Folder } from "./types.ts";
import { compareContacts } from "./types.ts";

/** One folder's worth of the list view: the folder heading (or `null` for the
 *  ungrouped contacts shown at the root), and the active contacts it holds,
 *  already in display order. */
export type ContactGroup = {
  /** The folder this group heads, or `null` for the ungrouped root group. */
  folder: Folder | null;
  contacts: Contact[];
};

/** Group a document's active contacts by folder for the overview screen.
 *  Non-archived folders come first in document order (each shown even when
 *  empty, mirroring the side menu), then the ungrouped contacts as a trailing
 *  `null` group — only when there are any. Archived folders and archived
 *  contacts are left out; contacts within each group are sorted by display
 *  name (nameless last), the same order the side menu uses. */
export function groupContactsByFolder(data: AppData): ContactGroup[] {
  const groups: ContactGroup[] = [];
  for (const folder of data.folders.filter((f) => !f.archived)) {
    const contacts = data.contacts
      .filter((c) => c.folderId === folder.id && !c.archived)
      .sort(compareContacts);
    groups.push({ folder, contacts });
  }
  const standalone = data.contacts
    .filter((c) => c.folderId === null && !c.archived)
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
