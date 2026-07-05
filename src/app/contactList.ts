// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The list view's grouping model. The overview screen (`ContactListScreen`)
// lays every active contact out under the folder it belongs to; this module is
// the pure shape behind that — which folders show, and which contacts sit in
// each — kept out of the component so it is unit-testable in node (see
// `tests/contactList_test.ts`). It reads the same "archived things drop out of
// the view but stay in the document" rule the side menu follows.

import { primaryPhone } from "./primaryPhone.ts";
import type { FolderSort, ListPhonePriority } from "./useAppSettings.ts";
import type { AppData, Contact, Folder, Phone } from "./types.ts";
import { compareContacts, methodKind } from "./types.ts";

/** Order a folder list for display. `manual` keeps the document (hand-dragged)
 *  order untouched; `alphabetical` sorts a copy by name, case-insensitively.
 *  Pure and total — the input is never mutated, so callers can hand it a
 *  filtered slice. */
export function sortFolders(
  folders: readonly Folder[],
  sort: FolderSort,
): Folder[] {
  if (sort === "manual") return [...folders];
  return [...folders].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/** The parent a folder nests under, normalised against the folders actually
 *  present: a `null`/absent `parentId`, or one pointing at a folder that isn't
 *  in `present`, both read as `null` (a root). This keeps a subfolder whose
 *  parent was pruned (deleted, archived out of the slice) from vanishing —
 *  it surfaces at the root rather than being orphaned. */
function normalisedParent(
  folder: Folder,
  present: ReadonlySet<string>,
): string | null {
  const p = folder.parentId ?? null;
  return p !== null && present.has(p) ? p : null;
}

/** Group folders by their (normalised) parent id, each sibling list ordered per
 *  `sort`. The `null` key holds the root folders. Only the folders handed in are
 *  considered "present", so passing a filtered slice (e.g. the non-archived
 *  folders) reparents any subfolder whose parent fell outside the slice up to
 *  the root. */
export function childrenByParent(
  folders: readonly Folder[],
  sort: FolderSort,
): Map<string | null, Folder[]> {
  const present = new Set(folders.map((f) => f.id));
  const byParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const key = normalisedParent(folder, present);
    (byParent.get(key) ?? byParent.set(key, []).get(key)!).push(folder);
  }
  if (sort === "alphabetical") {
    for (const siblings of byParent.values())
      siblings.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }
  return byParent;
}

/** A folder paired with its nesting depth — 0 for a root folder, 1 for its
 *  child, and so on. The shape the menu and the List walk to indent each row. */
export type FolderNode = { folder: Folder; depth: number };

/** Flatten the folders into depth-first (pre-order) reading order — each folder
 *  immediately followed by its subtree — annotating every one with its
 *  {@link FolderNode.depth}. `sort` orders siblings at each level. Cycle-safe:
 *  a folder reached twice (a corrupt parent loop) is emitted once. */
export function orderedFolderTree(
  folders: readonly Folder[],
  sort: FolderSort,
): FolderNode[] {
  const byParent = childrenByParent(folders, sort);
  const out: FolderNode[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const folder of byParent.get(parent) ?? []) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      out.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Every folder id strictly below `rootId` (its children, their children, …),
 *  not including `rootId` itself. Cycle-safe. */
export function descendantFolderIds(
  folders: readonly Folder[],
  rootId: string,
): Set<string> {
  const byParent = childrenByParent(folders, "manual");
  const out = new Set<string>();
  const walk = (parent: string) => {
    for (const child of byParent.get(parent) ?? []) {
      if (out.has(child.id)) continue;
      out.add(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return out;
}

/** `rootId` together with every folder id below it — the whole subtree, the set
 *  an archive / delete / cross-namespace move sweeps as one. */
export function subtreeFolderIds(
  folders: readonly Folder[],
  rootId: string,
): Set<string> {
  const ids = descendantFolderIds(folders, rootId);
  ids.add(rootId);
  return ids;
}

/** Whether reparenting `folderId` under `parentId` is legal: not itself, and not
 *  into its own subtree (which would sever the branch into a cycle). A `null`
 *  target (the root) is always legal. */
export function canNestFolder(
  folders: readonly Folder[],
  folderId: string,
  parentId: string | null,
): boolean {
  if (parentId === null) return true;
  if (parentId === folderId) return false;
  return !descendantFolderIds(folders, folderId).has(parentId);
}

/** One folder's worth of the list view: the folder heading (or `null` for the
 *  ungrouped contacts shown at the root), and the active contacts it holds,
 *  already in display order. */
export type ContactGroup = {
  /** The folder this group heads, or `null` for the ungrouped root group. */
  folder: Folder | null;
  /** Nesting depth of the heading — 0 for a root folder and the ungrouped
   *  group, 1 for a subfolder, and so on. Drives the section's indentation. */
  depth: number;
  contacts: Contact[];
};

/** Options narrowing which active contacts the overview groups. Defaults to
 *  every active card; `favoritesOnly` keeps just the starred ones — the
 *  Favorites page is the same folder-grouped layout over that shortlist. */
export type GroupOptions = {
  /** When set, keep only contacts flagged `favorite`. */
  favoritesOnly?: boolean;
  /** How to order the folder sections. Defaults to `manual` (document order),
   *  which is what the view showed before the setting existed. */
  folderSort?: FolderSort;
};

/** Group a document's active contacts by folder for the overview screen.
 *  Non-archived folders come first — walked depth-first so each subfolder
 *  follows its parent (Family, then Family ▸ Spouse, …), ordered per
 *  `opts.folderSort` (document order by default, alphabetically when asked) —
 *  then the ungrouped contacts as a trailing `null` group. A folder shows when
 *  its **subtree** holds at least one active contact: a folder with no direct
 *  contacts of its own still heads a section when a descendant has some (so the
 *  child stays reachable), while a wholly empty branch drops out. Archived
 *  folders and archived contacts are left out; contacts within each group are
 *  sorted by display name (nameless last), the same order the side menu uses.
 *  With `favoritesOnly`, only starred contacts are kept — so a branch with no
 *  favorites drops out just as an empty one does, and the Favorites page reuses
 *  this whole shape. Each group carries its {@link ContactGroup.depth}. */
export function groupContactsByFolder(
  data: AppData,
  opts: GroupOptions = {},
): ContactGroup[] {
  const keep = (c: Contact) =>
    !c.archived && (!opts.favoritesOnly || !!c.favorite);
  const folders = data.folders.filter((f) => !f.archived);
  const byParent = childrenByParent(folders, opts.folderSort ?? "manual");
  const directContacts = (folderId: string | null) =>
    data.contacts
      .filter((c) => (c.folderId ?? null) === folderId && keep(c))
      .sort(compareContacts);

  // Memoised, cycle-safe "does this folder's subtree hold a kept contact?".
  // A branch with no direct contacts anywhere in it drops out of the list.
  const hasContactsCache = new Map<string, boolean>();
  const subtreeHasContacts = (folder: Folder, stack: Set<string>): boolean => {
    const cached = hasContactsCache.get(folder.id);
    if (cached !== undefined) return cached;
    if (stack.has(folder.id)) return false; // cycle — treat as empty
    stack.add(folder.id);
    const has =
      directContacts(folder.id).length > 0 ||
      (byParent.get(folder.id) ?? []).some((c) => subtreeHasContacts(c, stack));
    stack.delete(folder.id);
    hasContactsCache.set(folder.id, has);
    return has;
  };

  const groups: ContactGroup[] = [];
  const emit = (folder: Folder, depth: number) => {
    if (!subtreeHasContacts(folder, new Set())) return;
    groups.push({ folder, depth, contacts: directContacts(folder.id) });
    for (const child of byParent.get(folder.id) ?? []) emit(child, depth + 1);
  };
  for (const root of byParent.get(null) ?? []) emit(root, 0);

  const standalone = directContacts(null);
  if (standalone.length > 0)
    groups.push({ folder: null, depth: 0, contacts: standalone });
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
 *  lifted out and re-inserted next to the target. `place` says which side of the
 *  target it lands on ("before" / "after"), following which half of the target
 *  row the pointer was released over; omit it and the id simply takes the
 *  target's slot (dropping onto a card above lands it above, below lands it
 *  below). A no-op (same list) when either id is missing or they're the same. */
export function reorderIds(
  ids: readonly string[],
  dragId: string,
  targetId: string,
  place?: "before" | "after",
): string[] {
  if (dragId === targetId) return [...ids];
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1) return [...ids];
  const next = ids.filter((id) => id !== dragId);
  if (place) {
    const t = next.indexOf(targetId);
    next.splice(place === "after" ? t + 1 : t, 0, dragId);
    return next;
  }
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

/** The phone numbers the **Favorites** page shows for a contact: just the one
 *  flagged primary when it has one, otherwise the same set the List shows under
 *  `priority`. So a starred card with a designated primary reads as a single
 *  tap-to-call, while one that never picked a primary keeps the fuller list.
 *  The caller has already dropped empty values (so the primary lookup only ever
 *  finds a number worth showing). */
export function favoritePhones(
  phones: readonly Phone[],
  priority: ListPhonePriority,
): Phone[] {
  const primary = primaryPhone(phones);
  return primary ? [primary] : prioritizePhones(phones, priority);
}
