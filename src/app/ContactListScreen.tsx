// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useRef, useState, type ReactNode } from "react";

import {
  CheckboxGlyph,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyButton,
  FloatingPanel,
  FolderIcon,
  FolderOpenIcon,
  GripIcon,
  type FloatingPlacement,
} from "@niclaslindstedt/oss-framework/components";
import {
  useDragDrop,
  type DragHandleProps,
} from "@niclaslindstedt/oss-framework/sidebar";
import { unlock } from "@niclaslindstedt/oss-framework/achievements";

import { Avatar } from "./Avatar.tsx";
import {
  CheckSquareIcon,
  DownloadIcon,
  FavoriteIcon,
  ListIcon,
} from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { formatPhoneValue } from "./countries/index.ts";
import { phoneOptions, type AppSettings } from "./useAppSettings.ts";
import { contactsToCsv, contactsToVCards } from "./export.ts";
import { downloadText, MIME_CSV, MIME_VCARD } from "./download.ts";
import {
  favoriteContacts,
  groupContactsByFolder,
  listedContacts,
  prioritizePhones,
  reorderIds,
} from "./contactList.ts";
import type { ContactStore } from "./useContactStore.ts";
import type { Contact } from "./types.ts";
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
// on its own screen.

const EXPORT_MENU_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 176 },
  anchor: "right",
  coordinateSpace: "viewport",
};

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
  const { data, updateContact, reorderFavorites } = store;
  const favoritesOnly = variant === "favorites";
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

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      {selecting ? (
        <SelectHeader
          count={selectedContacts.length}
          allSelected={allSelected}
          onToggleAll={toggleSelectAll}
          onCancel={exitSelect}
          contacts={selectedContacts}
        />
      ) : (
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
          {total > 0 && (
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
      )}

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-10 [overscroll-behavior:contain]">
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
            const expanded = !collapsed.has(key);
            // A folder-less document (only the null group) needs no heading —
            // the rows read as one flat list. Otherwise every section, the
            // ungrouped one included, gets a collapsible header.
            const showHeader = group.folder !== null || groups.length > 1;
            return (
              <section key={key} className="mb-1">
                {showHeader && (
                  <SectionHeader
                    name={group.folder?.name ?? t("list.ungrouped")}
                    count={group.contacts.length}
                    expanded={expanded}
                    onToggle={() => toggleSection(key)}
                  />
                )}
                {expanded && (
                  <ul className="m-0 list-none p-0">
                    {group.contacts.map((contact) => (
                      <li key={contact.id}>
                        <ContactRow
                          contact={contact}
                          settings={settings}
                          selecting={selecting}
                          selected={selected.has(contact.id)}
                          onOpen={() => onOpenContact(contact.id)}
                          onToggleSelected={() => toggleSelected(contact.id)}
                          onToggleFavorite={() => toggleFavorite(contact)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
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
    >
      <GripIcon className="h-5 w-5" />
    </button>
  );
}

// The header shown while selecting: cancel, the running count, a select-all
// toggle, and the batch copy / export actions (inert until something's ticked).
function SelectHeader({
  count,
  allSelected,
  onToggleAll,
  onCancel,
  contacts,
}: {
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onCancel: () => void;
  contacts: Contact[];
}) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const exportRef = useRef<HTMLButtonElement>(null);
  const has = count > 0;

  const runExport = (kind: "vcf" | "csv") => {
    if (kind === "vcf") {
      downloadText("contacts.vcf", contactsToVCards(contacts), MIME_VCARD);
    } else {
      downloadText("contacts.csv", contactsToCsv(contacts), MIME_CSV);
    }
    unlock("exporter");
    setMenuOpen(false);
  };

  return (
    <header className="mb-2 flex flex-col gap-2 border-b border-line px-1 pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("common.cancel")}
          title={t("common.cancel")}
          className="-ml-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-wide text-fg-bright tabular-nums">
          {t("list.selectedCount", { n: String(count) })}
        </h1>
        <CopyButton
          value={() => contactsToVCards(contacts)}
          onCopied={() => unlock("exporter")}
          labels={{ copy: t("list.copy"), copied: t("contact.copied") }}
        />
        <button
          ref={exportRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={!has}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t("list.export")}
          title={t("list.export")}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
            has
              ? "cursor-pointer border-line text-muted hover:bg-surface-2 hover:text-fg"
              : "cursor-not-allowed border-line text-muted opacity-40"
          }`}
        >
          <DownloadIcon className="h-4 w-4" />
        </button>
        <FloatingPanel
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          triggerRef={exportRef}
          placement={EXPORT_MENU_PLACEMENT}
          className="py-1"
        >
          <div role="menu" className="flex w-full flex-col">
            <ExportMenuItem onClick={() => runExport("vcf")}>
              {t("list.exportVCard")}
            </ExportMenuItem>
            <ExportMenuItem onClick={() => runExport("csv")}>
              {t("list.exportCsv")}
            </ExportMenuItem>
          </div>
        </FloatingPanel>
      </div>
      <button
        type="button"
        onClick={onToggleAll}
        role="checkbox"
        aria-checked={allSelected}
        className="flex w-fit cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-medium text-fg hover:text-fg-bright"
      >
        <span className="shrink-0" aria-hidden>
          <CheckboxGlyph checked={allSelected} />
        </span>
        {t("list.selectAll")}
      </button>
    </header>
  );
}

function ExportMenuItem({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
    >
      {children}
    </button>
  );
}

// A collapsible folder / ungrouped heading — a disclosure caret, the folder
// glyph, its name, and the member count.
function SectionHeader({
  name,
  count,
  expanded,
  onToggle,
}: {
  name: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full cursor-pointer items-center gap-2 border-b border-line px-1 py-2 text-left text-fg hover:text-fg-bright"
    >
      <span className="shrink-0 text-muted">
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </span>
      <span className={`shrink-0 ${expanded ? "text-accent" : "text-muted"}`}>
        {expanded ? (
          <FolderOpenIcon className="h-5 w-5" />
        ) : (
          <FolderIcon className="h-5 w-5" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide">
        {name}
      </span>
      <span className="shrink-0 text-xs text-muted tabular-nums">{count}</span>
    </button>
  );
}

// One contact in the list. Out of select mode the avatar + name is a button
// that opens the card, and each phone / email under it is its own tap-to-act
// link. In select mode the whole row is a toggle for the checkbox, and the
// contact methods read as plain text (there's nothing to call while picking).
function ContactRow({
  contact,
  settings,
  selecting,
  selected,
  onOpen,
  onToggleSelected,
  onToggleFavorite,
  grip,
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
  // With more than one number on show, prefix each with its Private / Work type
  // so it's clear which is which; a lone number needs no such label.
  const showPhoneKind = phones.length > 1;
  // The card-size setting drives both the avatar size and the row's breathing
  // room, so a spacious list reads bigger throughout, not just its photos.
  const spacious = settings.listDensity === "spacious";
  const avatarSize = spacious ? "list-spacious" : "list-compact";
  const rowSpacing = spacious ? "gap-4 py-3" : "gap-3 py-2";

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
        className={`flex w-full cursor-pointer items-center border-b border-line px-1 text-left ${rowSpacing} ${
          selected ? "bg-accent/10" : "hover:bg-surface-2"
        }`}
      >
        <span className="shrink-0" aria-hidden>
          <CheckboxGlyph checked={selected} />
        </span>
        <Avatar contact={contact} size={avatarSize} />
        <span className="flex min-w-0 flex-1 flex-col">
          {nameNode}
          <ContactMethodsText
            phones={phones.map((p) => {
              const value = formatPhoneValue(
                p.value,
                settings.country,
                phoneOptions(settings),
              );
              return showPhoneKind ? `${kindText(p.label, t)} ${value}` : value;
            })}
            emails={emails.map((e) => e.value)}
          />
        </span>
      </button>
    );
  }

  const hasMethods = phones.length > 0 || emails.length > 0;
  return (
    <div
      className={`flex items-center border-b border-line px-1 transition-colors hover:bg-surface-2 ${rowSpacing}`}
    >
      {grip}
      <button
        type="button"
        onClick={onOpen}
        aria-label={name || t("contact.unnamed")}
        className="shrink-0 cursor-pointer"
      >
        <Avatar contact={contact} size={avatarSize} />
      </button>
      {/* Narrow screens stack the methods under the name; from `sm` up there's
          room to sit them to the right of it, so the row reads on one line. */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 cursor-pointer text-left leading-tight sm:flex-1"
        >
          {nameNode}
        </button>
        {/* Phone numbers (tap to call) then emails (tap to write) in smaller
            text — each its own link, so the row stays a plain container rather
            than a button wrapping links. Left-aligned under the name on mobile,
            right-aligned beside it on wider screens. */}
        {hasMethods ? (
          <div className="flex min-w-0 flex-col gap-0.5 sm:max-w-[55%] sm:shrink-0 sm:items-end">
            {phones.map((phone) => (
              <a
                key={phone.id}
                href={`tel:${phone.value.replace(/\s+/g, "")}`}
                className="w-fit max-w-full truncate text-xs text-accent hover:underline sm:text-right"
              >
                {showPhoneKind && (
                  <span className="text-muted">
                    {kindText(phone.label, t)}{" "}
                  </span>
                )}
                {formatPhoneValue(
                  phone.value,
                  settings.country,
                  phoneOptions(settings),
                )}
              </a>
            ))}
            {emails.map((email) => (
              <a
                key={email.id}
                href={`mailto:${email.value.trim()}`}
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
      onClick={onToggle}
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

// The Private / Work label for a phone number, shown as a prefix when a row
// carries more than one so it's clear which is which.
function kindText(
  label: string | undefined,
  t: ReturnType<typeof useT>,
): string {
  return methodKind(label) === "work"
    ? t("contact.kindWork")
    : t("contact.kindPrivate");
}

// The plain-text echo of a contact's methods shown under the name while
// selecting (no links — the row is busy being a checkbox).
function ContactMethodsText({
  phones,
  emails,
}: {
  phones: string[];
  emails: string[];
}) {
  if (phones.length === 0 && emails.length === 0) return null;
  return (
    <span className="truncate text-xs text-muted">
      {[...phones, ...emails].join(" · ")}
    </span>
  );
}
