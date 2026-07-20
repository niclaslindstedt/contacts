// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  ArchiveIcon,
  BuildingIcon,
  CheckboxGlyph,
  CheckSquareIcon,
  ChevronDownIcon,
  ConfirmDialog,
  ChevronRightIcon,
  FolderOpenIcon,
  GripIcon,
  ListIcon,
  PersonIcon,
  RowActionMenu,
  SlidersIcon,
  SwipeableRow,
  TrashIcon,
  type FloatingPoint,
  type RowAction,
} from "@niclaslindstedt/oss-framework/components";
import {
  useDragDrop,
  type DragHandleProps,
} from "@niclaslindstedt/oss-framework/sidebar";
import { SyncStatus } from "@niclaslindstedt/oss-framework/sync";

import { Avatar } from "./Avatar.tsx";
import { ContactListFilters } from "./ContactListFilters.tsx";
import {
  EMPTY_FILTER,
  filterContacts,
  isFilterActive,
  activeFilterCount,
  relationsInUse,
  type ContactFilter,
} from "./contactFilter.ts";
import { FavoriteIcon, SectionsToggleIcon } from "./icons.tsx";
import { MassEditModal } from "./MassEditModal.tsx";
import { MoveToFolderMenu } from "./MoveToFolderMenu.tsx";
import { SelectActions, SelectCountBar } from "./SelectToast.tsx";
import { allTags } from "./tags.ts";
import { customRelationsInUse } from "./relation.ts";
import { useT } from "./i18n/index.ts";
import { formatPhoneValue } from "./countries/index.ts";
import { phoneOptions, type AppSettings } from "./useAppSettings.ts";
import {
  favoriteContacts,
  favoritePhones,
  groupContactsByFolder,
  listedContacts,
  prioritizePhones,
  rangeBetween,
  reorderIds,
} from "./contactList.ts";
import { toastStore, UNDO_TOAST_MS } from "./toast.ts";
import type { ContactStore } from "./useContactStore.ts";
import type { SyncEngine } from "./useSyncEngine.ts";
import type { Contact, Phone } from "./types.ts";
import { displayName, methodKind } from "./types.ts";

// The overview list — a top-level view, reached from the side menu's List
// button. Where the card screen shows one contact and the sidebar is a terse
// switcher, this lays every active contact out in the main area, grouped under
// the folder it belongs to (each folder a collapsible section, expanded by
// default). Each row wears a big avatar with the name beside it and, when the
// List settings tab enables them, the contact's phone numbers (tap to call)
// and emails (tap to compose) under it, then a heart to star the card.
//
// The same screen doubles as the Favorites page: pass `variant="favorites"`
// and it renders the identical folder-grouped layout over just the starred
// contacts (empty folders drop out the same way). Its own List button and the
// Favorites button in the side menu both land here — one filtered, one not.
//
// A "Select" toggle turns the rows into a multi-select: tick as many as you
// like, then copy them as one vCard block, export the selection to a vCard /
// CSV file, or delete the lot from the header's trash button (behind a
// confirmation) — the batch counterpart to what a single card offers on its
// own screen. Select mode is driven from a floating toolbar that hovers at
// the bottom of the page (`SelectToast`); a Ctrl / Cmd-click on any row
// enters it directly. On the List page a card can also be **dragged into a
// folder section** to file it there (the whole selection moves together), and
// the row's right-click actions — Move to folder, Archive, Delete — all carry
// the whole selection when the clicked card is part of it.

// The sentinel collapse key for the trailing ungrouped ("no folder") section,
// which has no folder id of its own.
const UNGROUPED = "__ungrouped__";

export function ContactListScreen({
  store,
  settings,
  sync,
  onOpenSyncDetails,
  onOpenContact,
  variant = "all",
  pendingTag = null,
  onPendingTagApplied,
}: {
  store: ContactStore;
  settings: AppSettings;
  // The app's sync engine — drives the header `SyncStatus` glyph, the same one
  // the card screen shows, so the save state stays in reach while browsing.
  sync: SyncEngine;
  // Open the framework `SyncDetailsModal` (mounted by the app shell).
  onOpenSyncDetails: () => void;
  // Open a contact on its card (sets it active and returns to the card view).
  onOpenContact: (id: string) => void;
  // "all" is the List page (every active contact); "favorites" is the
  // Favorites page (only starred cards), same layout over a filtered set.
  variant?: "all" | "favorites";
  // A tag the app wants applied as the active filter — set when the user
  // presses a tag chip on a contact card, which navigates here. Consumed once
  // (the effect applies it and calls `onPendingTagApplied` to clear it), so it
  // reads as a one-shot request rather than a controlled filter value.
  pendingTag?: string | null;
  onPendingTagApplied?: () => void;
}) {
  const t = useT();
  const {
    data,
    updateContact,
    reorderFavorites,
    moveContactsToFolder,
    bulkEditContacts,
    archiveContact,
    archiveContacts,
    deleteContact,
    deleteContacts,
    archiveFolder,
    deleteFolder,
  } = store;
  const favoritesOnly = variant === "favorites";

  // The active list filter — narrow the shown cards to one relationship, one
  // tag, and/or one card type. Local view state (like collapse / select), it
  // doesn't travel with the document. `filtersOpen` reveals the dropdown bar.
  const [filter, setFilter] = useState<ContactFilter>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterActive = isFilterActive(filter);
  // A tag pressed on a contact card navigates here asking for that tag as the
  // active filter. Apply it once: set the tag facet (leaving any relationship /
  // card-type facet in place), reveal the filter bar so the applied filter is
  // visible and adjustable, then tell the app it's been consumed so the same
  // request doesn't re-fire on every later render.
  useEffect(() => {
    if (pendingTag === null) return;
    setFilter((prev) => ({ ...prev, tag: pendingTag }));
    setFiltersOpen(true);
    onPendingTagApplied?.();
  }, [pendingTag, onPendingTagApplied]);
  // The document the list groups over, with the filter applied to its contacts.
  // Grouping and the favorites shortlist both read this, so a folder whose cards
  // all fall outside the filter drops out just like an empty one. The relation /
  // tag option lists and folder machinery still read the unfiltered `data`.
  const filteredData = useMemo(
    () =>
      filterActive
        ? { ...data, contacts: filterContacts(data.contacts, filter) }
        : data,
    [data, filter, filterActive],
  );
  // The relationship and tag choices the filter bar offers — the values actually
  // in use across the active (non-archived) cards, so a filter never lists an
  // option that would match nothing.
  const activeContacts = useMemo(
    () => data.contacts.filter((c) => !c.archived),
    [data.contacts],
  );
  const relationChoices = useMemo(
    () => relationsInUse(activeContacts),
    [activeContacts],
  );
  const tagChoices = useMemo(() => allTags(activeContacts), [activeContacts]);

  // The folders a card can be filed into — the non-archived set, shared by the
  // drag-and-drop drop zones and the "Move to folder" right-click submenu.
  const activeFolders = useMemo(
    () => data.folders.filter((f) => !f.archived),
    [data.folders],
  );
  // The List page groups every active card by folder; the Favorites page is a
  // single hand-orderable shortlist instead (see `favoriteContacts`), so
  // reordering can move a card freely rather than only within one folder.
  const groups = useMemo(
    () =>
      favoritesOnly
        ? []
        : groupContactsByFolder(filteredData, {
            folderSort: settings.folderSort,
          }),
    [filteredData, favoritesOnly, settings.folderSort],
  );
  const favorites = useMemo(
    () => (favoritesOnly ? favoriteContacts(filteredData) : []),
    [filteredData, favoritesOnly],
  );
  // Star / unstar a card. Reuses the same field-patch path every other edit
  // takes, so a favorite toggle is one undoable step and syncs like any change.
  // Unstarring on the Favorites page drops the card out of view, so it raises
  // the shared undo toast (as archive / delete do) to make the removal one tap
  // to reverse — everywhere else the heart just fills / empties in place.
  const toggleFavorite = (contact: Contact) => {
    const removing = !!contact.favorite;
    updateContact(contact.id, { favorite: !contact.favorite });
    if (favoritesOnly && removing) {
      toastStore.clear();
      toastStore.push({
        message: t("toast.favoriteRemoved"),
        icon: <FavoriteIcon className="h-4 w-4" filled />,
        durationMs: UNDO_TOAST_MS,
        action: {
          label: t("toast.undo"),
          onAction: () => store.undo(),
        },
      });
    }
  };

  // Which sections are collapsed. Default-expanded — local view state, it
  // doesn't travel with the document.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // A collapsed folder section folds its subfolders away with it, so a group
  // whose ancestor is collapsed is skipped entirely. Climbs the parent chain of
  // a group's folder looking for a collapsed link.
  const foldersById = useMemo(
    () => new Map(data.folders.map((f) => [f.id, f])),
    [data.folders],
  );
  const isSectionHidden = (folderId: string | null): boolean => {
    let p =
      folderId === null ? null : (foldersById.get(folderId)?.parentId ?? null);
    while (p !== null) {
      if (collapsed.has(p)) return true;
      p = foldersById.get(p)?.parentId ?? null;
    }
    return false;
  };
  // The key of the last section that still renders a header band (visible, not
  // folded under a collapsed ancestor). Every section above it has a folder
  // below, so its last row drops its bottom rule; the final section keeps it.
  const lastVisibleSectionKey = (() => {
    let key: string | null = null;
    for (const g of groups) {
      if (!isSectionHidden(g.folder?.id ?? null)) {
        key = g.folder?.id ?? UNGROUPED;
      }
    }
    return key;
  })();
  // The section keys the header's collapse-all button folds (and unfolds) in one
  // tap — every group that shows a heading (a folder, plus the ungrouped group
  // when it isn't the whole list). `allCollapsed` flips the button to "expand
  // all" once they're all shut, mirroring the sidebar's folder toggle.
  const collapsibleKeys = useMemo(
    () =>
      groups
        .filter((g) => g.folder !== null || groups.length > 1)
        .map((g) => g.folder?.id ?? UNGROUPED),
    [groups],
  );
  const allCollapsed =
    collapsibleKeys.length > 0 &&
    collapsibleKeys.every((key) => collapsed.has(key));
  const setAllCollapsed = (collapse: boolean) =>
    setCollapsed(collapse ? new Set(collapsibleKeys) : new Set());

  // Select mode: off shows tap-to-open rows; on shows checkboxes and the batch
  // copy / export toolbar. Leaving select mode clears the selection.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // The anchor a Shift-click ranges from — the last row ticked with a plain
  // click (or the card select mode was entered on). Local view state, kept in a
  // ref so updating it never re-renders the list.
  const anchorRef = useRef<string | null>(null);

  const allContacts = useMemo(
    () => (favoritesOnly ? favorites : listedContacts(groups)),
    [favoritesOnly, favorites, groups],
  );
  const total = allContacts.length;
  const selectedContacts = allContacts.filter((c) => selected.has(c.id));
  const allSelected = total > 0 && selectedContacts.length === total;

  // The contacts actually on screen, in reading order — every card whose section
  // is neither collapsed nor folded away under a collapsed ancestor. This is the
  // run a Shift-click ranges over: it flattens the folders, so a Shift-click
  // spanning two sections sweeps every visible row between them and skips the
  // ones tucked inside a shut folder. The Favorites page has no sections, so its
  // whole list is visible.
  const visibleContacts = useMemo(() => {
    if (favoritesOnly) return favorites;
    return groups
      .filter(
        (g) =>
          !isSectionHidden(g.folder?.id ?? null) &&
          !collapsed.has(g.folder?.id ?? UNGROUPED),
      )
      .flatMap((g) => g.contacts);
    // `isSectionHidden` reads `collapsed`/`foldersById`, both in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesOnly, favorites, groups, collapsed, foldersById]);

  const enterSelect = () => setSelecting(true);
  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
    anchorRef.current = null;
  };
  // Leave select mode when the view switches between List and Favorites — the
  // screen stays mounted across that swap (only `favoritesOnly` flips), so the
  // selection would otherwise linger onto a page it wasn't made on. Navigating
  // to any other screen unmounts this one, which resets the mode on its own.
  useEffect(() => {
    setSelecting(false);
    setSelected(new Set());
    anchorRef.current = null;
  }, [favoritesOnly]);
  const toggleSelectAll = () =>
    setSelected(
      allSelected ? new Set() : new Set(allContacts.map((c) => c.id)),
    );
  // Ctrl / Cmd-clicking a row (out of select mode) enters select mode with just
  // that card ticked — the quick way into a multi-select without reaching for
  // the toolbar button first. That card also seeds the Shift-click anchor.
  const enterSelectWith = (id: string) => {
    setSelecting(true);
    setSelected(new Set([id]));
    anchorRef.current = id;
  };

  // A click on a select-mode row. A plain click toggles just that card and moves
  // the anchor to it; a Shift-click ticks every visible card between the anchor
  // and this one (folders and all), leaving the anchor put so the range can be
  // grown or redrawn from the same start. Falls back to a plain toggle when
  // there's no anchor yet or it has scrolled out of the visible run.
  const selectRow = (id: string, extend: boolean) => {
    const anchor = anchorRef.current;
    if (extend && anchor && anchor !== id) {
      const range = rangeBetween(
        visibleContacts.map((c) => c.id),
        anchor,
        id,
      );
      if (range.length > 0) {
        setSelected((prev) => new Set([...prev, ...range]));
        return;
      }
    }
    toggleSelected(id);
    anchorRef.current = id;
  };
  // Tick (or clear) every contact directly under one folder's heading in one
  // tap — the folder-level checkbox shown beside each section header while
  // selecting. Selecting a folder doesn't disturb the Shift-click anchor.
  const toggleGroupSelected = (ids: readonly string[], allOn: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  // The ids a drag / move acts on: the whole selection when the grabbed card is
  // part of it, otherwise just that one card. Lets a single drag file every
  // ticked contact into a folder at once.
  const idsForAction = (id: string): string[] =>
    selecting && selected.has(id)
      ? allContacts.filter((c) => selected.has(c.id)).map((c) => c.id)
      : [id];
  const moveToFolder = (ids: string[], folderId: string | null) =>
    moveContactsToFolder(ids, folderId);

  // Batch archive / delete over the ticked selection. Archive goes through in
  // one undoable step; delete first asks — `confirmDelete` holds the ids while
  // the confirmation dialog is up, and nothing is removed until it's confirmed.
  // Both drop the acted-on ids from the selection so the ticked set never
  // carries ghosts of cards that just left the list.
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  // The bulk-edit modal — open while the "Edit selected" toolbar button has
  // raised it. Its typeahead sources (relationships and tags already in use)
  // come from the whole document, the same way the single-card editor's do.
  const [massEditOpen, setMassEditOpen] = useState(false);
  const knownRelations = useMemo(
    () => customRelationsInUse(data.contacts),
    [data.contacts],
  );
  const knownTags = useMemo(() => allTags(data.contacts), [data.contacts]);
  const dropFromSelection = (ids: readonly string[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  const archiveBatch = (ids: string[]) => {
    archiveContacts(ids);
    dropFromSelection(ids);
  };
  const runConfirmedDelete = () => {
    if (confirmDelete) {
      deleteContacts(confirmDelete);
      dropFromSelection(confirmDelete);
    }
    setConfirmDelete(null);
  };

  // The per-row actions shared by both pages, mirroring the side menu's contact
  // rows: a left-swipe **Delete** button, a right-swipe **Archive** commit, and
  // the desktop right-click menu (Move to folder / Archive / Delete). Like a
  // drag, every action carries the whole selection when the grabbed card is
  // part of it (the labels pick up the count so the reach is explicit), and a
  // multi-card delete asks for confirmation first; on an unticked card each
  // acts on that single row, immediately.
  const contactRowActions = (contact: Contact) => {
    const ids = idsForAction(contact.id);
    const many = ids.length > 1;
    const deleteAction: RowAction = {
      label: many
        ? t("menu.deleteContacts", { n: String(ids.length) })
        : t("menu.deleteContact"),
      icon: <TrashIcon className="h-5 w-5" />,
      danger: true,
      onSelect: () =>
        many ? setConfirmDelete(ids) : deleteContact(contact.id),
    };
    const archiveAction: RowAction = {
      label: many
        ? t("menu.archiveContacts", { n: String(ids.length) })
        : t("menu.archive"),
      icon: <ArchiveIcon className="h-5 w-5" />,
      onSelect: () => (many ? archiveBatch(ids) : archiveContact(contact.id)),
    };
    // Filing into a folder is offered whenever there's somewhere to go: a folder
    // to land in, or (for an already-filed card) the root to lift it back to.
    const canMove = activeFolders.length > 0 || contact.folderId !== null;
    const moveAction: RowAction = {
      label: many
        ? t("menu.moveContactsToFolder", { n: String(ids.length) })
        : t("menu.moveToFolder"),
      icon: <FolderOpenIcon className="h-5 w-5" />,
      onSelect: () => setMovePicker({ ids, at: movePos.current }),
    };
    const menuActions: RowAction[] = [
      ...(canMove ? [moveAction] : []),
      archiveAction,
      deleteAction,
    ];
    return { deleteAction, archiveAction, menuActions };
  };

  // Drag-and-drop of contacts into folder sections (List page only). A row is a
  // drag source; each folder section is a drop zone that files the dragged card
  // — or the whole selection — into it. The ungrouped section drops to the root.
  const scrollRef = useRef<HTMLDivElement>(null);
  const dnd = useDragDrop<
    string,
    { kind: "folder"; id: string } | { kind: "root" }
  >({
    canDrop: (dragId) => allContacts.some((c) => c.id === dragId),
    onDrop: (dragId, target) =>
      moveToFolder(
        idsForAction(dragId),
        target.kind === "folder" ? target.id : null,
      ),
  });
  // While a drag is in flight, auto-scroll the list when the pointer nears its
  // top / bottom edge — so a card low in a long list can be dragged up to a
  // folder above without letting go.
  const pointerRef = useRef(dnd.pointer);
  pointerRef.current = dnd.pointer;
  const dragging = dnd.dragging !== null;
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const EDGE = 56; // px hot zone at each edge
    const MAX = 14; // px per frame at the very edge
    const step = () => {
      const el = scrollRef.current;
      const p = pointerRef.current;
      if (el && p) {
        const rect = el.getBoundingClientRect();
        if (p.y < rect.top + EDGE) {
          el.scrollTop -= Math.ceil(
            MAX * Math.min(1, (rect.top + EDGE - p.y) / EDGE),
          );
        } else if (p.y > rect.bottom - EDGE) {
          el.scrollTop += Math.ceil(
            MAX * Math.min(1, (p.y - (rect.bottom - EDGE)) / EDGE),
          );
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dragging]);

  // The "Move to folder" right-click submenu — `movePos` captures where the row
  // was right-clicked; `movePicker` holds the ids to move once the action fires.
  const movePos = useRef<FloatingPoint>({ x: 0, y: 0 });
  const [movePicker, setMovePicker] = useState<{
    ids: string[];
    at: FloatingPoint;
  } | null>(null);

  return (
    <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col px-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      {/* The title stays put — select mode no longer replaces it. The batch
          copy / export actions join the collapse and Select buttons in this top
          menu while selecting; the running count lives in the floating
          `SelectCountBar` below. */}
      <header className="mb-2 flex items-center gap-3 border-b border-line px-1 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          {favoritesOnly ? (
            <FavoriteIcon className="h-5 w-5" filled />
          ) : (
            <ListIcon className="h-5 w-5" />
          )}
        </span>
        {/* While selecting, the batch-action buttons fill this rail, so the
            page title's text would crowd them — drop it to just the leading
            glyph and let an empty flex spacer keep the actions pushed right.
            The heading stays in the DOM (sr-only) so the page keeps its H1. */}
        <h1
          className={`min-w-0 flex-1 truncate text-lg font-bold tracking-wide text-fg-bright ${
            selecting ? "sr-only" : ""
          }`}
        >
          {favoritesOnly ? t("favorites.title") : t("list.title")}
        </h1>
        {selecting && <div className="flex-1" aria-hidden />}
        {/* The filter toggle — reveals the dropdown bar (relationship, tag, card
            type). A little accent dot marks it when a filter is applied, so an
            active filter reads even with the bar folded away. Hidden while
            selecting, where the header fills with batch actions; the filter
            stays applied and the bar returns on leaving select mode. */}
        {!selecting && (activeContacts.length > 0 || filterActive) && (
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-pressed={filtersOpen}
            aria-label={
              filtersOpen ? t("list.filter.hide") : t("list.filter.show")
            }
            title={filtersOpen ? t("list.filter.hide") : t("list.filter.show")}
            className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border ${
              filtersOpen || filterActive
                ? "border-accent bg-accent/10 text-accent hover:bg-accent/15"
                : "border-line text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <SlidersIcon className="h-5 w-5" />
            {filterActive && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-page-bg"
              >
                {activeFilterCount(filter)}
              </span>
            )}
          </button>
        )}
        {/* The collapse-all button stays in the top menu while selecting. */}
        {collapsibleKeys.length > 0 && (
          <button
            type="button"
            onClick={() => setAllCollapsed(!allCollapsed)}
            aria-label={
              allCollapsed
                ? t("menu.expandAllFolders")
                : t("menu.collapseAllFolders")
            }
            title={
              allCollapsed
                ? t("menu.expandAllFolders")
                : t("menu.collapseAllFolders")
            }
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 hover:text-fg"
          >
            <SectionsToggleIcon className="h-5 w-5" collapsed={allCollapsed} />
          </button>
        )}
        {/* Batch copy / export / edit / delete, shown only while a selection is
            being made. The pencil opens the bulk-edit modal (assign tags, a
            relationship, or a card type to the whole selection); the trash hands
            the ticked ids to the same confirmation the row menu's multi-delete
            uses. All stay inert until at least one card is ticked. */}
        {selecting && (
          <SelectActions
            contacts={selectedContacts}
            onEdit={() => setMassEditOpen(true)}
            onDelete={() => setConfirmDelete(selectedContacts.map((c) => c.id))}
          />
        )}
        {total > 0 && (
          <button
            type="button"
            onClick={selecting ? exitSelect : enterSelect}
            aria-pressed={selecting}
            aria-label={selecting ? t("list.exitSelect") : t("list.select")}
            title={selecting ? t("list.exitSelect") : t("list.select")}
            className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border ${
              selecting
                ? "border-accent bg-accent/10 text-accent hover:bg-accent/15"
                : "border-line text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <CheckSquareIcon className="h-5 w-5" />
          </button>
        )}
        {/* The framework sync glyph — the same one the card header carries, so
            the save state stays visible (and the command centre one tap away)
            while browsing the List / Favorites pages. Hidden while a selection
            is being made: select mode fills this rail with its own batch
            actions, so the sync glyph steps aside until it's dismissed. */}
        {!selecting && (
          <SyncStatus
            providerName={sync.providerName}
            status={sync.status}
            dirty={sync.dirty}
            offline={sync.offline}
            onOpenDetails={onOpenSyncDetails}
            labels={{
              saving: t("sync.saving"),
              syncedTo: (n) => t("sync.syncedTo", { name: n }),
              saveUnsaved: t("sync.saveUnsaved"),
              failed: t("sync.failed"),
              throttled: t("sync.throttled"),
              reauthRequired: t("sync.reauthRequired"),
              syncConflict: t("sync.syncConflict"),
              offline: t("sync.offline"),
            }}
          />
        )}
      </header>

      {/* The filter dropdown bar — revealed by the header's filter button, kept
          above the scrolling list so it stays put while browsing. Hidden while
          selecting (the header is busy with batch actions then), though any
          applied filter still narrows the ticked set. */}
      {filtersOpen && !selecting && (
        <ContactListFilters
          filter={filter}
          relations={relationChoices}
          tags={tagChoices}
          onChange={setFilter}
        />
      )}

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto [overscroll-behavior:contain] ${
          selecting ? "pb-24" : "pb-10"
        }`}
      >
        {/* The select-all toggle rides at the very top of the list as its own
            special row (rather than in the floating toolbar) while selecting. */}
        {selecting && total > 0 && (
          <SelectAllRow allSelected={allSelected} onToggle={toggleSelectAll} />
        )}
        {total === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted">
            {filterActive
              ? t("list.filter.empty")
              : favoritesOnly
                ? t("favorites.empty")
                : t("list.empty")}
          </p>
        ) : favoritesOnly ? (
          <FavoritesReorderList
            contacts={favorites}
            settings={settings}
            selecting={selecting}
            selected={selected}
            rowActionsFor={contactRowActions}
            onCapturePos={(x, y) => {
              movePos.current = { x, y };
            }}
            onOpenContact={onOpenContact}
            onToggleSelected={selectRow}
            onToggleFavorite={toggleFavorite}
            onReorder={(dragId, targetId, place) =>
              reorderFavorites(
                reorderIds(
                  favorites.map((c) => c.id),
                  dragId,
                  targetId,
                  place,
                ),
              )
            }
          />
        ) : (
          groups.map((group) => {
            const key = group.folder?.id ?? UNGROUPED;
            // Folded away under a collapsed ancestor — skip it whole.
            if (isSectionHidden(group.folder?.id ?? null)) return null;
            const expanded = !collapsed.has(key);
            // A folder-less document (only the null group) needs no heading —
            // the rows read as one flat list. Otherwise every section, the
            // ungrouped one included, gets a collapsible header.
            const showHeader = group.folder !== null || groups.length > 1;
            // True while another folder section renders below this one, so this
            // section's last row should drop its trailing rule.
            const folderBelow = key !== lastVisibleSectionKey;
            // Each section is a drop zone — dropping a card (or the whole
            // selection) here files it into this folder, or un-groups it to the
            // root over the ungrouped section.
            const zone = dnd.dropZone(
              key,
              group.folder
                ? { kind: "folder", id: group.folder.id }
                : { kind: "root" },
            );
            const dropOver = zone.isOver && dragging;
            // The folder-level checkbox shown beside the heading while selecting
            // — one tap ticks (or clears) every contact directly under this
            // folder. Checked once they're all in; a fresh tap on a full folder
            // clears just its rows.
            const groupIds = group.contacts.map((c) => c.id);
            const groupAllSelected =
              groupIds.length > 0 && groupIds.every((id) => selected.has(id));
            const selectCheckbox =
              selecting && groupIds.length > 0 ? (
                <SectionSelectCheckbox
                  checked={groupAllSelected}
                  label={
                    group.folder
                      ? t("list.selectFolder", { name: group.folder.name })
                      : t("list.selectUngrouped")
                  }
                  onToggle={() =>
                    toggleGroupSelected(groupIds, groupAllSelected)
                  }
                />
              ) : undefined;
            // Subfolder sections step to the right so the nesting reads at a
            // glance (Family, then Family ▸ Spouse indented under it).
            return (
              <section
                key={key}
                ref={zone.ref}
                className="mb-1"
                style={
                  group.depth > 0
                    ? { paddingLeft: `${group.depth}rem` }
                    : undefined
                }
              >
                {showHeader &&
                  (group.folder ? (
                    // A real folder's header carries the folder's own actions —
                    // swipe right to archive it, swipe left to delete it, or a
                    // desktop right-click for the menu. This is where folder
                    // archive / delete moved to once the side menu dropped swipe.
                    <FolderSectionHeader
                      name={group.folder.name}
                      count={group.contacts.length}
                      expanded={expanded}
                      onToggle={() => toggleSection(key)}
                      dropOver={dropOver}
                      onArchive={() => archiveFolder(group.folder!.id)}
                      onDelete={() => deleteFolder(group.folder!.id)}
                      archiveLabel={t("menu.archive")}
                      deleteLabel={t("menu.deleteFolder")}
                      menuLabel={t("menu.folderActions")}
                      selectCheckbox={selectCheckbox}
                    />
                  ) : (
                    // The trailing "no folder" section is a grouping, not a
                    // folder — nothing to archive or delete, so it stays plain.
                    <SectionHeader
                      name={t("list.ungrouped")}
                      count={group.contacts.length}
                      expanded={expanded}
                      onToggle={() => toggleSection(key)}
                      dropOver={dropOver}
                      leading={selectCheckbox}
                    />
                  ))}
                {expanded && (
                  <ul className="m-0 list-none p-0">
                    {group.contacts.map((contact, i) => (
                      <li key={contact.id}>
                        <DraggableContactRow
                          dragHandle={dnd.dragHandle(contact.id)}
                          actions={contactRowActions(contact)}
                          menuLabel={t("menu.contactActions")}
                          archiveLabel={t("menu.archive")}
                          onCapturePos={(x, y) => {
                            movePos.current = { x, y };
                          }}
                          onModifiedClick={
                            selecting
                              ? undefined
                              : () => enterSelectWith(contact.id)
                          }
                        >
                          <ContactRow
                            contact={contact}
                            settings={settings}
                            selecting={selecting}
                            selected={selected.has(contact.id)}
                            onOpen={() => onOpenContact(contact.id)}
                            onToggleSelected={(extend) =>
                              selectRow(contact.id, extend)
                            }
                            onToggleFavorite={() => toggleFavorite(contact)}
                            last={
                              folderBelow && i === group.contacts.length - 1
                            }
                          />
                        </DraggableContactRow>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* The floating count pill — hovers at the bottom over the list. */}
      {selecting && <SelectCountBar count={selectedContacts.length} />}

      {/* The "Move to folder" right-click submenu. */}
      <MoveToFolderMenu
        folders={activeFolders}
        folderSort={settings.folderSort}
        position={movePicker ? movePicker.at : null}
        onMove={(folderId) => {
          if (movePicker) moveToFolder(movePicker.ids, folderId);
          setMovePicker(null);
        }}
        onClose={() => setMovePicker(null)}
      />

      {/* The bulk-edit modal — raised by the header's pencil button. Applies one
          set of changes (tags to add, a relationship, a card type) across the
          whole ticked selection in a single undoable step, then closes; the
          selection is left intact so more can be done with it. */}
      <MassEditModal
        open={massEditOpen}
        count={selectedContacts.length}
        relations={knownRelations}
        tags={knownTags}
        onApply={(edit) => {
          bulkEditContacts(
            selectedContacts.map((c) => c.id),
            edit,
          );
          setMassEditOpen(false);
        }}
        onClose={() => setMassEditOpen(false)}
      />

      {/* The batch-delete confirmation — raised by the header's trash button
          and by the row menu's multi-card Delete; the delete only goes through
          on confirm (and is still one undoable step afterwards). */}
      <ConfirmDialog
        open={confirmDelete !== null}
        tone="danger"
        title={
          confirmDelete?.length === 1
            ? t("list.deleteConfirmTitleOne")
            : t("list.deleteConfirmTitle", {
                n: String(confirmDelete?.length ?? 0),
              })
        }
        description={
          confirmDelete?.length === 1
            ? t("list.deleteConfirmBodyOne")
            : t("list.deleteConfirmBody")
        }
        confirmLabel={t("menu.deleteContact")}
        onConfirm={runConfirmedDelete}
        onCancel={() => setConfirmDelete(null)}
        labels={{ close: t("common.close"), cancel: t("common.cancel") }}
      />
    </div>
  );
}

// A List-page contact row wrapped for drag-and-drop, swipe actions, and its
// right-click menu — the same set the side menu's contact rows carry: the whole
// row is a drag source (press-drag to file it into a folder section), a swipe
// left reveals **Delete** and a swipe right commits **Archive**, a Ctrl /
// Cmd-click enters select mode with it ticked, and a right-click opens the row
// actions (Move to folder / Archive / Delete). A plain click still falls
// through to the row's own open / toggle handlers.
function DraggableContactRow({
  dragHandle,
  actions,
  menuLabel,
  archiveLabel,
  onCapturePos,
  onModifiedClick,
  children,
}: {
  dragHandle: DragHandleProps;
  actions: {
    deleteAction: RowAction;
    archiveAction: RowAction;
    menuActions: RowAction[];
  };
  menuLabel: string;
  archiveLabel: string;
  onCapturePos: (x: number, y: number) => void;
  // Called when the row is clicked with Ctrl / Cmd held (enter select mode).
  // Absent while already selecting, so a modified click just toggles as usual.
  onModifiedClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      {...dragHandle}
      data-drawer-swipe-ignore
      // Record the right-click point (capture phase) so the folder submenu
      // opens there.
      onContextMenuCapture={(e) => onCapturePos(e.clientX, e.clientY)}
      // Intercept a Ctrl / Cmd-click before the row's buttons / links act on
      // it, turning it into "enter select mode with this card".
      onClickCapture={(e) => {
        if (onModifiedClick && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          e.stopPropagation();
          onModifiedClick();
        }
      }}
    >
      <ContactRowActions
        actions={actions}
        menuLabel={menuLabel}
        archiveLabel={archiveLabel}
      >
        {children}
      </ContactRowActions>
    </div>
  );
}

// The swipe strip + right-click menu wrapper shared by both pages, mirroring the
// side menu's contact rows: a left swipe latches a **Delete** button, a right
// swipe commits **Archive**, and a desktop right-click opens the full action
// menu (touch reaches the same actions through the swipe strip, so the menu
// stays a pointer affordance).
function ContactRowActions({
  actions,
  menuLabel,
  archiveLabel,
  swipe = true,
  children,
}: {
  actions: {
    deleteAction: RowAction;
    archiveAction: RowAction;
    menuActions: RowAction[];
  };
  menuLabel: string;
  archiveLabel: string;
  // Whether the row bares its swipe strip (archive right / delete left). On by
  // default for the List page; the Favorites page turns it off — swipe is a
  // List-page affordance, so a Favorites row only carries the right-click menu.
  swipe?: boolean;
  children: ReactNode;
}) {
  return (
    <RowActionMenu
      actions={actions.menuActions}
      touchLongPress={false}
      ariaLabel={menuLabel}
    >
      {swipe ? (
        <SwipeableRow
          actions={[actions.deleteAction]}
          leading={{
            kind: "commit",
            onCommit: actions.archiveAction.onSelect,
            label: archiveLabel,
            icon: <ArchiveIcon className="h-5 w-5" />,
          }}
        >
          {children}
        </SwipeableRow>
      ) : (
        children
      )}
    </RowActionMenu>
  );
}

// The Favorites page's body: one flat, hand-orderable list. Each row wears a
// grip at its leading edge; the framework's `useDragDrop` owns the gesture
// (long-press on touch, a small drag on a pointer), and dropping a card onto
// another reorders the whole shortlist. Select mode suppresses the grips — you
// can't reorder and multi-select at once — but the rows still tick. Dragging is
// disabled implicitly there because no handle is rendered.
function FavoritesReorderList({
  contacts,
  settings,
  selecting,
  selected,
  rowActionsFor,
  onCapturePos,
  onOpenContact,
  onToggleSelected,
  onToggleFavorite,
  onReorder,
}: {
  contacts: Contact[];
  settings: AppSettings;
  selecting: boolean;
  selected: ReadonlySet<string>;
  // Builds the right-click actions for a row. Favorites rows don't swipe (that
  // stays a List-page affordance), so only the menu actions are used here.
  rowActionsFor: (contact: Contact) => {
    deleteAction: RowAction;
    archiveAction: RowAction;
    menuActions: RowAction[];
  };
  // Record where a row was right-clicked so the "Move to folder" submenu opens
  // at the pointer.
  onCapturePos: (x: number, y: number) => void;
  onOpenContact: (id: string) => void;
  onToggleSelected: (id: string, extend: boolean) => void;
  onToggleFavorite: (contact: Contact) => void;
  onReorder: (
    dragId: string,
    targetId: string,
    place?: "before" | "after",
  ) => void;
}) {
  const t = useT();
  // The live row elements (to measure where the pointer sits within a row) and
  // the pending drop side, both read at drop time from inside the hook's
  // `onDrop` — so they go through refs to dodge stale closures.
  const rowEls = useRef(new Map<string, HTMLElement>());
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const dropRef = useRef<{
    targetId: string;
    place: "before" | "after";
  } | null>(null);
  const dnd = useDragDrop<string, string>({
    canDrop: (drag, target) => drag !== target,
    onDrop: (drag, target) => {
      const pending = dropRef.current;
      onReorderRef.current(
        drag,
        target,
        pending?.targetId === target ? pending.place : undefined,
      );
    },
  });
  const pointer = dnd.pointer;
  const dragging = dnd.dragging;
  return (
    <ul className="m-0 list-none p-0">
      {contacts.map((contact) => {
        const zone = dnd.dropZone(contact.id, contact.id);
        // A thin insertion line — not a box ring — marks where the card will
        // land, so the gesture reads as "drop between rows" rather than "merge
        // into this contact". The line (and the drop) hug the top edge when the
        // pointer is over the row's upper half and the bottom edge over the
        // lower half — the pointer's own position picks the slot.
        let showLine = false;
        let lineBelow = false;
        if (zone.isOver && dragging && pointer) {
          const rect = rowEls.current.get(contact.id)?.getBoundingClientRect();
          if (rect) {
            lineBelow = pointer.y > rect.top + rect.height / 2;
            showLine = true;
            dropRef.current = {
              targetId: contact.id,
              place: lineBelow ? "after" : "before",
            };
          }
        }
        const setRef = (el: HTMLElement | null) => {
          zone.ref(el);
          if (el) rowEls.current.set(contact.id, el);
          else rowEls.current.delete(contact.id);
        };
        return (
          <li
            key={contact.id}
            ref={setRef}
            className="relative"
            // Record the right-click point (capture phase) so the folder
            // submenu opens there.
            onContextMenuCapture={(e) => onCapturePos(e.clientX, e.clientY)}
          >
            {showLine && (
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-accent ${
                  lineBelow ? "bottom-0" : "top-0"
                }`}
              />
            )}
            <ContactRowActions
              actions={rowActionsFor(contact)}
              menuLabel={t("menu.contactActions")}
              archiveLabel={t("menu.archive")}
              swipe={false}
            >
              <ContactRow
                contact={contact}
                settings={settings}
                selecting={selecting}
                selected={selected.has(contact.id)}
                favoritesOnly
                onOpen={() => onOpenContact(contact.id)}
                onToggleSelected={(extend) =>
                  onToggleSelected(contact.id, extend)
                }
                onToggleFavorite={() => onToggleFavorite(contact)}
                grip={
                  selecting ? undefined : (
                    <ReorderGrip
                      handle={dnd.dragHandle(contact.id)}
                      label={t("favorites.reorder", {
                        name: displayName(contact) || t("contact.unnamed"),
                      })}
                    />
                  )
                }
              />
            </ContactRowActions>
          </li>
        );
      })}
    </ul>
  );
}

// The drag handle on a Favorites row — a grip the finger / pointer grabs to
// pick the row up. Spreads the framework hook's pointer handlers (and its
// `touch-action`, so a vertical scroll still works until the long-press lifts
// the row).
function ReorderGrip({
  handle,
  label,
}: {
  handle: DragHandleProps;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="mr-0.5 -ml-1 flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded text-muted hover:text-fg active:cursor-grabbing"
      {...handle}
      // The grip is for dragging, not opening — keep its click off the row.
      onClick={(e) => e.stopPropagation()}
    >
      <GripIcon className="h-5 w-5" />
    </button>
  );
}

// A collapsible section heading — deliberately unfoldery: a tinted separator
// band (its own surface colour, set apart from the white contact rows) with a
// disclosure caret and an uppercase label, so it reads as a collapsible divider
// between groups rather than a folder. No folder glyph. While a card is dragged
// over its section, `dropOver` washes the band in the accent so it reads as the
// landing group.
function SectionHeader({
  name,
  count,
  expanded,
  onToggle,
  dropOver = false,
  flush = false,
  leading,
}: {
  name: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  dropOver?: boolean;
  // Drop the band's own bottom margin. A header wrapped in a `SwipeableRow`
  // must be flush and carry the gap on the wrapper instead: the swipe layers
  // paint the wrapper's full box (`inset-0`), so a margin left inside it
  // renders as a strip of action colour taller than the visible band.
  flush?: boolean;
  // An interactive control shown at the band's leading edge, before the caret —
  // the select-mode folder checkbox. It sits *beside* the collapse button (a
  // button can't nest inside another), so when it's present the band becomes a
  // flex row of [control][collapse button] and the bottom gap moves out to that
  // row so the two align on one band.
  leading?: ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`${flush || leading ? "" : "mb-0.5"} flex ${leading ? "flex-1" : "w-full"} cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
        dropOver
          ? "bg-accent/15 text-fg-bright ring-1 ring-accent/50"
          : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg"
      }`}
    >
      <span className="shrink-0">
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide uppercase">
        {name}
      </span>
      <span className="shrink-0 text-xs tabular-nums opacity-70">{count}</span>
    </button>
  );
  if (!leading) return button;
  return (
    <div className={`${flush ? "" : "mb-0.5"} flex items-center gap-1`}>
      {leading}
      {button}
    </div>
  );
}

// A folder's section header, wrapped with the folder's own actions the way the
// contact rows are: a swipe right commits **Archive**, a swipe left reveals
// **Delete**, and a desktop right-click opens the same two as a menu. Deleting a
// folder here promotes its contacts up to the parent (see the store) rather than
// removing them, and both are undoable via the hovering toast. This is the touch
// home for folder archive / delete now that the side menu has dropped swipe.
function FolderSectionHeader({
  name,
  count,
  expanded,
  onToggle,
  dropOver,
  onArchive,
  onDelete,
  archiveLabel,
  deleteLabel,
  menuLabel,
  selectCheckbox,
}: {
  name: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  dropOver: boolean;
  onArchive: () => void;
  onDelete: () => void;
  archiveLabel: string;
  deleteLabel: string;
  menuLabel: string;
  // The select-mode folder checkbox, shown at the heading's leading edge while
  // a selection is being made — ticks or clears every contact in the folder.
  selectCheckbox?: ReactNode;
}) {
  const archiveAction: RowAction = {
    label: archiveLabel,
    icon: <ArchiveIcon className="h-5 w-5" />,
    onSelect: onArchive,
  };
  const deleteAction: RowAction = {
    label: deleteLabel,
    icon: <TrashIcon className="h-5 w-5" />,
    danger: true,
    onSelect: onDelete,
  };
  return (
    <RowActionMenu
      actions={[archiveAction, deleteAction]}
      touchLongPress={false}
      ariaLabel={menuLabel}
    >
      {/* The band's gap and radius live on the swipe container, not the header
          button: the swipe layers fill the container (`inset-0`), so the
          container must be exactly the visible band — same height (no inner
          margin) and same rounded clip — for the revealed buttons to match the
          row at every font scale and density. */}
      <SwipeableRow
        className="mb-0.5 rounded-md"
        actions={[deleteAction]}
        leading={{
          kind: "commit",
          onCommit: onArchive,
          label: archiveLabel,
          icon: <ArchiveIcon className="h-5 w-5" />,
        }}
      >
        <SectionHeader
          name={name}
          count={count}
          expanded={expanded}
          onToggle={onToggle}
          dropOver={dropOver}
          flush
          leading={selectCheckbox}
        />
      </SwipeableRow>
    </RowActionMenu>
  );
}

// The folder-level checkbox that rides the leading edge of a section heading
// while selecting. Reflects whether every contact directly under the folder is
// ticked; a tap ticks the whole folder, or clears it when it's already full. It
// sits beside the collapse caret (not inside it), so ticking a folder never also
// folds it — and its own click stops there rather than reaching any swipe /
// drop machinery the heading is wrapped in.
function SectionSelectCheckbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-drawer-swipe-ignore
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
    >
      <CheckboxGlyph checked={checked} />
    </button>
  );
}

// The select-all toggle, shown as the first row of the list while selecting. A
// tinted band (set apart from the contact rows, like the section headers) that
// leads with a checkbox reflecting whether every card is ticked and reads
// "Select all"; tapping it ticks the whole list, or clears it when all are
// already ticked. Its home is the top of the list rather than the floating
// toolbar, so it sits with the cards it acts on.
function SelectAllRow({
  allSelected,
  onToggle,
}: {
  allSelected: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={allSelected}
      aria-label={allSelected ? t("list.selectNone") : t("list.selectAll")}
      className="mb-1 flex w-full cursor-pointer items-center gap-3 rounded-md bg-surface-2 px-2 py-2.5 text-left text-fg hover:bg-surface-3"
    >
      <span className="shrink-0" aria-hidden>
        <CheckboxGlyph checked={allSelected} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {t("list.selectAll")}
      </span>
    </button>
  );
}

// One contact in the list. Out of select mode the whole row is a button that
// opens the card — a click anywhere but the interactive bits opens it — while
// each phone / email under it stays its own tap-to-act link and the trailing
// heart still toggles favorite in place (all of them stop the click from
// bubbling to the row so acting on one never also opens the card). In select
// mode the whole row is a toggle for the checkbox instead, and the contact
// methods read as plain text (there's nothing to call while picking).
function ContactRow({
  contact,
  settings,
  selecting,
  selected,
  onOpen,
  onToggleSelected,
  onToggleFavorite,
  grip,
  favoritesOnly = false,
  last = false,
}: {
  contact: Contact;
  settings: AppSettings;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  // Called when the row is tapped in select mode. `extend` is true for a
  // Shift-click (range-select from the anchor), false for a plain toggle.
  onToggleSelected: (extend: boolean) => void;
  onToggleFavorite: () => void;
  // The drag handle shown at the row's leading edge on the reorderable
  // Favorites page. Absent everywhere else — the row reads exactly as before.
  grip?: ReactNode;
  // On the Favorites page a card with a designated primary number shows only
  // that one number, not its whole list — so a starred contact reads as a single
  // tap-to-call. The full List page always shows the prioritized set.
  favoritesOnly?: boolean;
  // The last row of a section that has another folder section below it drops
  // its bottom rule, so a group reads as an enclosed block instead of drawing a
  // divider straight into the following folder's header band.
  last?: boolean;
}) {
  const t = useT();
  const name = displayName(contact);
  const visiblePhones = contact.phones.filter((p) => p.value.trim());
  const phones = settings.listShowPhone
    ? favoritesOnly
      ? favoritePhones(visiblePhones, settings.listPhonePriority)
      : prioritizePhones(visiblePhones, settings.listPhonePriority)
    : [];
  const emails = settings.listShowEmail
    ? contact.emails.filter((e) => e.value.trim())
    : [];
  // The card-size setting drives both the avatar size and the row's breathing
  // room, so a spacious list reads bigger throughout, not just its photos.
  const spacious = settings.listDensity === "spacious";
  const avatarSize = spacious ? "list-spacious" : "list-compact";
  const rowSpacing = spacious ? "gap-4 py-3" : "gap-3 py-2";
  // A spacious row wears a big 64px photo, so a lone small phone pill hugging
  // the name leaves an unbalanced gap of dead space beneath it. When there's a
  // single number, blow that one pill up and push it down off the name so the
  // name + pill together fill the photo's height and the row reads deliberate.
  const bigPill = spacious && phones.length === 1;
  // Every row rules off from the next with a bottom border, except the last row
  // of a section that has a folder below it — there the folder's own header band
  // is the divider, so a trailing rule just doubles it up.
  const borderClass = last ? "" : "border-b border-line";

  // Names wrap onto as many lines as they need rather than truncating, so a
  // long full name reads in full; `[overflow-wrap:anywhere]` also breaks a
  // single very long token (or unbroken unicode) instead of letting it push
  // the row wider than the screen.
  const nameNode = name ? (
    <span className="font-medium text-fg-bright [overflow-wrap:anywhere]">
      {name}
    </span>
  ) : (
    <span className="font-medium text-muted italic [overflow-wrap:anywhere]">
      {t("contact.unnamed")}
    </span>
  );

  if (selecting) {
    return (
      <button
        type="button"
        // Shift-click extends the selection from the anchor row; a plain click
        // toggles just this one. `onToggleSelected` reads which from the event.
        onClick={(e) => onToggleSelected(e.shiftKey)}
        aria-pressed={selected}
        aria-label={t("list.selectContact", {
          name: name || t("contact.unnamed"),
        })}
        className={`flex w-full cursor-pointer items-center ${borderClass} px-1 text-left ${rowSpacing} ${
          selected ? "bg-accent/10" : "hover:bg-surface-2"
        }`}
      >
        <span className="shrink-0" aria-hidden>
          <CheckboxGlyph checked={selected} />
        </span>
        <Avatar contact={contact} size={avatarSize} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {nameNode}
          <ContactMethodsText
            phones={phones}
            emails={emails.map((e) => e.value)}
            settings={settings}
          />
        </span>
      </button>
    );
  }

  const hasMethods = phones.length > 0 || emails.length > 0;
  // The whole row opens the card: it's a `role="button"` container so a click
  // anywhere on it — the empty space beside the name included — calls `onOpen`,
  // with Enter / Space doing the same for the keyboard. The phone pills, email
  // links, grip, and favorite heart nested inside stop their own clicks from
  // bubbling up (see their `stopPropagation`), so acting on one of those never
  // also opens the card.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={name || t("contact.unnamed")}
      className={`flex cursor-pointer items-center ${borderClass} px-1 transition-colors hover:bg-surface-2 ${rowSpacing}`}
    >
      {grip}
      <span className="shrink-0">
        <Avatar contact={contact} size={avatarSize} />
      </span>
      {/* Narrow screens stack the methods under the name; from `sm` up there's
          room to sit them to the right of it, so the row reads on one line. A
          lone big pill gets extra space above it (`gap-2`) so it drops toward
          the photo's foot instead of clinging to the name. */}
      <div
        className={`flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3 ${
          bigPill ? "gap-2" : "gap-0.5"
        }`}
      >
        <span className="min-w-0 leading-tight sm:flex-1">{nameNode}</span>
        {/* Phone numbers (tap to call) as Private / Work pills, then emails
            (tap to write) as smaller links — each its own link, so the row stays
            a plain container rather than a button wrapping links. Left-aligned
            under the name on mobile, right-aligned beside it on wider screens. */}
        {hasMethods ? (
          <div className="flex min-w-0 flex-col gap-1 sm:max-w-[55%] sm:shrink-0 sm:items-end">
            {phones.length > 0 && (
              <div className="flex w-full flex-wrap gap-1 sm:justify-end">
                {phones.map((phone) => (
                  <PhonePill
                    key={phone.id}
                    phone={phone}
                    settings={settings}
                    size={bigPill ? "lg" : "md"}
                    interactive
                  />
                ))}
              </div>
            )}
            {emails.map((email) => (
              <a
                key={email.id}
                href={`mailto:${email.value.trim()}`}
                onClick={(e) => e.stopPropagation()}
                className="w-fit max-w-full truncate text-xs text-muted hover:text-fg hover:underline sm:text-right"
              >
                {email.value}
              </a>
            ))}
          </div>
        ) : (
          !name && (
            <span className="truncate text-xs text-muted sm:shrink-0">
              {t("list.noContactMethods")}
            </span>
          )
        )}
      </div>
      {/* Star toggle, pinned to the row's trailing edge — outline when the card
          isn't a favorite, a filled accent heart when it is. On the Favorites
          page this is how a card leaves the list. */}
      <FavoriteToggle
        favorite={!!contact.favorite}
        name={name || t("contact.unnamed")}
        onToggle={onToggleFavorite}
      />
    </div>
  );
}

// The trailing heart on a list row. A small, thumb-sized toggle that flips a
// card's favorite flag in place without opening it — muted and hollow at rest,
// filled in the accent once starred.
function FavoriteToggle({
  favorite,
  name,
  onToggle,
}: {
  favorite: boolean;
  name: string;
  onToggle: () => void;
}) {
  const t = useT();
  const label = favorite
    ? t("contact.removeFavorite")
    : t("contact.addFavorite");
  return (
    <button
      type="button"
      // Stop the click here so starring a card doesn't also open it — the row
      // around this heart is itself a button that calls `onOpen`.
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={favorite}
      aria-label={`${label} — ${name}`}
      title={label}
      className={`ml-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${
        favorite
          ? "text-accent hover:bg-accent/10"
          : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      <FavoriteIcon className="h-5 w-5" filled={favorite} />
    </button>
  );
}

// One phone number rendered as a pill — a rounded chip that leads with the
// contact-method glyph (a person for a Private number, a briefcase for a Work
// one) so the type reads at a glance without spelling it out, then the
// formatted number. The glyphs are the same two the edit form's type toggle
// uses, so the list speaks the app's established visual language. Tap-to-call
// on the interactive list rows; a plain, non-tappable chip while selecting,
// where the row itself is the checkbox and there's nothing to dial. The type
// name rides along for screen readers and as the hover tooltip.
function PhonePill({
  phone,
  settings,
  interactive = false,
  size = "md",
}: {
  phone: Phone;
  settings: AppSettings;
  interactive?: boolean;
  // "md" is the standard chip; "lg" is the taller, roomier pill a spacious row
  // gives its single number so it fills the big photo's height (see `bigPill`).
  size?: "md" | "lg";
}) {
  const t = useT();
  const work = methodKind(phone.label) === "work";
  const Icon = work ? BuildingIcon : PersonIcon;
  const kindText = work ? t("contact.kindWork") : t("contact.kindPrivate");
  const value = formatPhoneValue(
    phone.value,
    settings.country,
    phoneOptions(settings),
  );
  const large = size === "lg";
  const base = `flex max-w-full items-center rounded-full bg-accent/10 font-medium text-accent ${
    large ? "gap-1.5 px-3 py-1.5 text-sm" : "gap-1 px-2 py-0.5 text-xs"
  }`;
  const iconSize = large ? "h-3.5 w-3.5" : "h-3 w-3";
  const body = (
    <>
      <Icon className={`${iconSize} shrink-0`} />
      <span className="sr-only">{kindText}</span>
      <span className="truncate">{value}</span>
    </>
  );
  if (!interactive) {
    return (
      <span className={base} title={`${kindText} · ${value}`}>
        {body}
      </span>
    );
  }
  return (
    <a
      href={`tel:${phone.value.replace(/\s+/g, "")}`}
      title={`${kindText} · ${value}`}
      // Dialing a number shouldn't also open the card the row-wide click opens.
      onClick={(e) => e.stopPropagation()}
      className={`${base} hover:bg-accent/20`}
    >
      {body}
    </a>
  );
}

// The echo of a contact's methods shown under the name while selecting (no
// links — the row is busy being a checkbox). Phones read as the same Private /
// Work pills the tappable rows use, just non-tappable; the emails follow as
// dot-separated text.
function ContactMethodsText({
  phones,
  emails,
  settings,
}: {
  phones: Phone[];
  emails: string[];
  settings: AppSettings;
}) {
  if (phones.length === 0 && emails.length === 0) return null;
  return (
    <span className="flex flex-col gap-1">
      {phones.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {phones.map((phone) => (
            <PhonePill key={phone.id} phone={phone} settings={settings} />
          ))}
        </span>
      )}
      {emails.length > 0 && (
        <span className="truncate text-xs text-muted">
          {emails.join(" · ")}
        </span>
      )}
    </span>
  );
}
