// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  CheckboxGlyph,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  GripIcon,
  RowActionMenu,
  type FloatingPoint,
} from "@niclaslindstedt/oss-framework/components";
import {
  useDragDrop,
  type DragHandleProps,
} from "@niclaslindstedt/oss-framework/sidebar";

import { Avatar } from "./Avatar.tsx";
import {
  BuildingIcon,
  CheckSquareIcon,
  FavoriteIcon,
  ListIcon,
  PersonIcon,
  SectionsToggleIcon,
} from "./icons.tsx";
import { MoveToFolderMenu } from "./MoveToFolderMenu.tsx";
import { SelectToast } from "./SelectToast.tsx";
import { useT } from "./i18n/index.ts";
import { formatPhoneValue } from "./countries/index.ts";
import { phoneOptions, type AppSettings } from "./useAppSettings.ts";
import {
  favoriteContacts,
  groupContactsByFolder,
  listedContacts,
  prioritizePhones,
  reorderIds,
} from "./contactList.ts";
import type { ContactStore } from "./useContactStore.ts";
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
// like, then copy them as one vCard block or export the selection to a vCard /
// CSV file — the batch counterpart to the copy / download a single card offers
// on its own screen. Select mode is driven from a floating toolbar that hovers
// at the bottom of the page (`SelectToast`); a Ctrl / Cmd-click on any row
// enters it directly. On the List page a card can also be **dragged into a
// folder section** to file it there (the whole selection moves together), or
// moved with the row's **Move to folder** right-click action.

// The sentinel collapse key for the trailing ungrouped ("no folder") section,
// which has no folder id of its own.
const UNGROUPED = "__ungrouped__";

export function ContactListScreen({
  store,
  settings,
  onOpenContact,
  variant = "all",
}: {
  store: ContactStore;
  settings: AppSettings;
  // Open a contact on its card (sets it active and returns to the card view).
  onOpenContact: (id: string) => void;
  // "all" is the List page (every active contact); "favorites" is the
  // Favorites page (only starred cards), same layout over a filtered set.
  variant?: "all" | "favorites";
}) {
  const t = useT();
  const { data, updateContact, reorderFavorites, moveContactsToFolder } = store;
  const favoritesOnly = variant === "favorites";
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
        : groupContactsByFolder(data, { folderSort: settings.folderSort }),
    [data, favoritesOnly, settings.folderSort],
  );
  const favorites = useMemo(
    () => (favoritesOnly ? favoriteContacts(data) : []),
    [data, favoritesOnly],
  );
  // Star / unstar a card. Reuses the same field-patch path every other edit
  // takes, so a favorite toggle is one undoable step and syncs like any change.
  const toggleFavorite = (contact: Contact) =>
    updateContact(contact.id, { favorite: !contact.favorite });

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

  const allContacts = useMemo(
    () => (favoritesOnly ? favorites : listedContacts(groups)),
    [favoritesOnly, favorites, groups],
  );
  const total = allContacts.length;
  const selectedContacts = allContacts.filter((c) => selected.has(c.id));
  const allSelected = total > 0 && selectedContacts.length === total;

  const enterSelect = () => setSelecting(true);
  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggleSelectAll = () =>
    setSelected(
      allSelected ? new Set() : new Set(allContacts.map((c) => c.id)),
    );
  // Ctrl / Cmd-clicking a row (out of select mode) enters select mode with just
  // that card ticked — the quick way into a multi-select without reaching for
  // the toolbar button first.
  const enterSelectWith = (id: string) => {
    setSelecting(true);
    setSelected(new Set([id]));
  };

  // The ids a drag / move acts on: the whole selection when the grabbed card is
  // part of it, otherwise just that one card. Lets a single drag file every
  // ticked contact into a folder at once.
  const idsForAction = (id: string): string[] =>
    selecting && selected.has(id)
      ? allContacts.filter((c) => selected.has(c.id)).map((c) => c.id)
      : [id];
  const moveToFolder = (ids: string[], folderId: string | null) =>
    moveContactsToFolder(ids, folderId);

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
      {/* The title stays put — select mode no longer replaces it. The count,
          exit ✕, and batch actions live in the floating `SelectToast` below. */}
      <header className="mb-2 flex items-center gap-3 border-b border-line px-1 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          {favoritesOnly ? (
            <FavoriteIcon className="h-5 w-5" filled />
          ) : (
            <ListIcon className="h-5 w-5" />
          )}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-wide text-fg-bright">
          {favoritesOnly ? t("favorites.title") : t("list.title")}
        </h1>
        {!selecting && collapsibleKeys.length > 0 && (
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
        {total > 0 && !selecting && (
          <button
            type="button"
            onClick={enterSelect}
            aria-label={t("list.select")}
            title={t("list.select")}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 hover:text-fg"
          >
            <CheckSquareIcon className="h-5 w-5" />
          </button>
        )}
      </header>

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto [overscroll-behavior:contain] ${
          selecting ? "pb-24" : "pb-10"
        }`}
      >
        {total === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted">
            {favoritesOnly ? t("favorites.empty") : t("list.empty")}
          </p>
        ) : favoritesOnly ? (
          <FavoritesReorderList
            contacts={favorites}
            settings={settings}
            selecting={selecting}
            selected={selected}
            onOpenContact={onOpenContact}
            onToggleSelected={toggleSelected}
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
                {showHeader && (
                  <SectionHeader
                    name={group.folder?.name ?? t("list.ungrouped")}
                    count={group.contacts.length}
                    expanded={expanded}
                    onToggle={() => toggleSection(key)}
                    dropOver={dropOver}
                  />
                )}
                {expanded && (
                  <ul className="m-0 list-none p-0">
                    {group.contacts.map((contact, i) => (
                      <li key={contact.id}>
                        <DraggableContactRow
                          dragHandle={dnd.dragHandle(contact.id)}
                          moveActions={
                            activeFolders.length > 0 ||
                            contact.folderId !== null
                              ? [
                                  {
                                    label: t("menu.moveToFolder"),
                                    icon: (
                                      <FolderOpenIcon className="h-5 w-5" />
                                    ),
                                    onSelect: () =>
                                      setMovePicker({
                                        ids: idsForAction(contact.id),
                                        at: movePos.current,
                                      }),
                                  },
                                ]
                              : []
                          }
                          menuLabel={t("menu.contactActions")}
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
                            onToggleSelected={() => toggleSelected(contact.id)}
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

      {/* The floating select toolbar — hovers at the bottom over the list. */}
      {selecting && (
        <SelectToast
          count={selectedContacts.length}
          allSelected={allSelected}
          onToggleAll={toggleSelectAll}
          onExit={exitSelect}
          contacts={selectedContacts}
        />
      )}

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
    </div>
  );
}

// A List-page contact row wrapped for drag-and-drop and its right-click menu:
// the whole row is a drag source (press-drag to file it into a folder section),
// a Ctrl / Cmd-click enters select mode with it ticked, and a right-click opens
// the row's actions (currently just "Move to folder"). A plain click still
// falls through to the row's own open / toggle handlers.
function DraggableContactRow({
  dragHandle,
  moveActions,
  menuLabel,
  onCapturePos,
  onModifiedClick,
  children,
}: {
  dragHandle: DragHandleProps;
  moveActions: {
    label: string;
    icon: ReactNode;
    onSelect: () => void;
  }[];
  menuLabel: string;
  onCapturePos: (x: number, y: number) => void;
  // Called when the row is clicked with Ctrl / Cmd held (enter select mode).
  // Absent while already selecting, so a modified click just toggles as usual.
  onModifiedClick?: () => void;
  children: ReactNode;
}) {
  return (
    <RowActionMenu
      actions={moveActions}
      touchLongPress={false}
      ariaLabel={menuLabel}
    >
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
        {children}
      </div>
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
  onOpenContact,
  onToggleSelected,
  onToggleFavorite,
  onReorder,
}: {
  contacts: Contact[];
  settings: AppSettings;
  selecting: boolean;
  selected: ReadonlySet<string>;
  onOpenContact: (id: string) => void;
  onToggleSelected: (id: string) => void;
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
          <li key={contact.id} ref={setRef} className="relative">
            {showLine && (
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-accent ${
                  lineBelow ? "bottom-0" : "top-0"
                }`}
              />
            )}
            <ContactRow
              contact={contact}
              settings={settings}
              selecting={selecting}
              selected={selected.has(contact.id)}
              onOpen={() => onOpenContact(contact.id)}
              onToggleSelected={() => onToggleSelected(contact.id)}
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
}: {
  name: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  dropOver?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`mb-0.5 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
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
  last = false,
}: {
  contact: Contact;
  settings: AppSettings;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
  onToggleFavorite: () => void;
  // The drag handle shown at the row's leading edge on the reorderable
  // Favorites page. Absent everywhere else — the row reads exactly as before.
  grip?: ReactNode;
  // The last row of a section that has another folder section below it drops
  // its bottom rule, so a group reads as an enclosed block instead of drawing a
  // divider straight into the following folder's header band.
  last?: boolean;
}) {
  const t = useT();
  const name = displayName(contact);
  const phones = settings.listShowPhone
    ? prioritizePhones(
        contact.phones.filter((p) => p.value.trim()),
        settings.listPhonePriority,
      )
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
        onClick={onToggleSelected}
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
