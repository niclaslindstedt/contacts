// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import {
  ArchiveIcon,
  CogIcon,
  ExternalLinkIcon,
  FloatingPanel,
  FolderIcon,
  FolderOpenIcon,
  HeartIcon,
  HelpCircleIcon,
  InlineEditRow,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  RowActionMenu,
  SearchIcon,
  SparklesIcon,
  SwipeableRow,
  TrashIcon,
  UndoIcon,
  type FloatingPlacement,
} from "@niclaslindstedt/oss-framework/components";
import {
  NamespaceSwitcher,
  type Namespace,
} from "@niclaslindstedt/oss-framework/namespaces";
import {
  CheckForUpdatesItem,
  type PwaUpdateCheckResult,
} from "@niclaslindstedt/oss-framework/pwa";
import {
  useDragDrop,
  type DragHandleProps,
} from "@niclaslindstedt/oss-framework/sidebar";

import { Avatar } from "./Avatar.tsx";
import { ListIcon, PersonIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import type { ContactStore } from "./useContactStore.ts";
import type { Contact } from "./types.ts";
import { compareContacts, displayName } from "./types.ts";

// What a side-menu drag carries (a contact or a whole folder) and where it
// can land. The framework's `useDragDrop` owns the gesture; these app types
// are the only domain it ever sees — kept here, never in the framework.
type DragItem = { kind: "contact" | "folder"; id: string };
type DropTarget =
  | { kind: "folder"; id: string }
  | { kind: "root" }
  | { kind: "namespace"; slug: string }
  | { kind: "archive" };

// The About dropdown opens up-and-to-the-left of its footer trigger; the
// framework's `FloatingPanel` flips it above automatically.
const ABOUT_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 200 },
  anchor: "left",
  coordinateSpace: "viewport",
};

// The project links surfaced in the footer (Donate) and the About dropdown
// (Source code).
const SOURCE_URL = "https://github.com/niclaslindstedt/contacts";
// The donate link is configurable at build time (`VITE_DONATE_URL`, wired up
// as a repository variable in the deploy workflows) so the sponsorship target
// can change without a code edit; it falls back to the project's GitHub
// Sponsors page when unset. See `docs/configuration.md`.
const DONATE_URL =
  (import.meta.env.VITE_DONATE_URL as string | undefined) ||
  "https://github.com/sponsors/niclaslindstedt";
// The subtitle under the Source row — the build identifier, composed at build
// time (`__BUILD_LABEL__`, see `vite.config.ts`): the version, the CI run
// number, the deploy slot (`-pre` for preview, `-br` for a branch build), and
// the short commit hash, e.g. `1.3.0.237-pre+4f23a97`.
const BUILD_LABEL = __BUILD_LABEL__;

// The navigation drawer's content — the rows the framework `Sidebar` shell
// frames. This is the app's own navigation (the framework owns only the
// docked/drawer framing around it): the namespace header, the contact list
// grouped into folders, the bottom action grid, and the footer.

type Props = {
  store: ContactStore;
  // The workspace the menu's contacts belong to — heads the framework
  // `NamespaceSwitcher`, which highlights its row as active.
  activeNamespace: Namespace;
  namespaces: Namespace[];
  onSwitchNamespace: (slug: string) => void;
  onOpenNamespaces: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenChangelog: () => void;
  // Close the drawer after a navigation (a no-op when the sidebar is docked)
  // and return the main area to the contact view.
  onNavigate: () => void;
  // The active top-level view — highlights the List / Archive buttons when
  // their page shows.
  view: "contact" | "archive" | "list";
  onShowArchive: () => void;
  // Open the overview List page (all contacts, grouped by folder).
  onShowList: () => void;
  // PWA update state, threaded from `usePwaUpdate`.
  checkingUpdate: boolean;
  updateAvailable: boolean;
  onCheckUpdate: () => Promise<PwaUpdateCheckResult>;
  // The framework `TrophyButton` in its row form, seated among the footer
  // rows (or nothing when achievements are switched off).
  trophy?: ReactNode;
  // Notified while a nav row is picked up and dragged, so the host can
  // suppress competing global gestures (pull-to-refresh) for the duration.
  onDraggingChange?: (dragging: boolean) => void;
};

export function SideMenuContent({
  store,
  onDraggingChange,
  activeNamespace,
  namespaces,
  onSwitchNamespace,
  onOpenNamespaces,
  onOpenSettings,
  onOpenSearch,
  onOpenChangelog,
  onNavigate,
  view,
  onShowArchive,
  onShowList,
  checkingUpdate,
  updateAvailable,
  onCheckUpdate,
  trophy,
}: Props) {
  const t = useT();
  const {
    data,
    addContact,
    addFolder,
    renameFolder,
    deleteFolder,
    archiveFolder,
    deleteContact,
    archiveContact,
    moveContactToFolder,
    moveContactToNamespace,
    moveFolderToNamespace,
    setActive,
    undo,
    redo,
    canUndo,
    canRedo,
  } = store;

  // Drag-and-drop wiring. The framework hook tracks the gesture and hit-tests
  // the drop zones; the app says which drops are legal (`canDrop`) and what
  // each one means (`onDrop`) — reparent into a folder or back to the root,
  // hand a contact / folder to another namespace, or archive it.
  const dnd = useDragDrop<DragItem, DropTarget>({
    onDraggingChange,
    canDrop: (drag, target) => {
      switch (target.kind) {
        case "folder":
        case "root":
          // Every folder (and the root) is a valid target for a contact —
          // including its current container; dropping back is a harmless
          // no-op, so a picked-up card can always be returned home.
          return (
            drag.kind === "contact" &&
            data.contacts.some((c) => c.id === drag.id)
          );
        case "namespace":
          return true;
        case "archive":
          return true;
      }
    },
    onDrop: (drag, target) => {
      switch (target.kind) {
        case "folder":
          moveContactToFolder(drag.id, target.id);
          break;
        case "root":
          moveContactToFolder(drag.id, null);
          break;
        case "namespace":
          if (drag.kind === "contact")
            moveContactToNamespace(drag.id, target.slug);
          else moveFolderToNamespace(drag.id, target.slug);
          break;
        case "archive":
          if (drag.kind === "contact") archiveContact(drag.id);
          else archiveFolder(drag.id);
          break;
      }
    },
  });
  const archiveZone = dnd.dropZone("archive", { kind: "archive" });
  const rootZone = dnd.dropZone("root", { kind: "root" });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  // A new folder isn't created until it's named: the "New folder" action drops
  // an inline editor into the list, and only a non-empty name commits it.
  const [creatingFolder, setCreatingFolder] = useState(false);
  // A new contact follows the same pattern: the "New" button (root) or a
  // folder's "+" drops an inline editor in the spot the card will land, and
  // only a non-empty name commits it. `null` when none is being created.
  const [creatingContactIn, setCreatingContactIn] = useState<
    string | null | false
  >(false);
  // The folder / contact whose name is being edited in place, or `null`.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  // The footer "About" dropdown, anchored to `aboutRef` and flipped upward.
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLButtonElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);

  function toggleFolder(id: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pick(id: string) {
    setActive(id);
    onNavigate();
  }

  // Open the inline "name your new contact" editor. A card created inside a
  // folder needs that folder expanded so the editor is visible.
  function beginCreateContact(folderId: string | null) {
    if (folderId !== null) {
      setCollapsedFolders((prev) => {
        if (!prev.has(folderId)) return prev;
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
    setCreatingContactIn(folderId);
  }

  function commitCreateContact(folderId: string | null, fullName: string) {
    addContact(folderId, fullName);
    setCreatingContactIn(false);
    onNavigate();
  }

  // One contact row, in a folder (`indent`) or at the root. A swipeable nav
  // row — swipe left for the trash strip (delete), swipe right to archive. A
  // desktop pointer reaches the same actions through the right-click menu.
  function renderContact(contact: Contact, indent: boolean) {
    const deleteAction = {
      label: t("menu.deleteContact"),
      icon: <TrashIcon className="h-5 w-5" />,
      danger: true,
      onSelect: () => deleteContact(contact.id),
    };
    const menuActions = [
      {
        label: t("menu.archive"),
        icon: <ArchiveIcon className="h-5 w-5" />,
        onSelect: () => archiveContact(contact.id),
      },
      deleteAction,
    ];
    const active = contact.id === data.activeContactId;
    return (
      <DraggableRow
        key={contact.id}
        handle={dnd.dragHandle({ kind: "contact", id: contact.id })}
      >
        <RowActionMenu
          ariaLabel={t("menu.contactActions")}
          actions={menuActions}
          // The touch hold drags the row; on touch these actions stay
          // reachable through the swipe strip, so the menu opens only on a
          // desktop right-click.
          touchLongPress={false}
        >
          <SwipeableRow
            actions={[deleteAction]}
            leading={{
              kind: "commit",
              onCommit: () => archiveContact(contact.id),
              label: t("menu.archive"),
              icon: <ArchiveIcon className="h-5 w-5" />,
            }}
          >
            <NavRow
              indent={indent}
              active={active}
              icon={<Avatar contact={contact} size="row" />}
              onClick={() => pick(contact.id)}
            >
              <span className="flex-1 truncate">
                {displayName(contact) || (
                  <span className="text-muted">{t("contact.unnamed")}</span>
                )}
              </span>
            </NavRow>
          </SwipeableRow>
        </RowActionMenu>
      </DraggableRow>
    );
  }

  // Archived folders / contacts drop out of the menu but stay in the document
  // — the Archive button's badge counts them.
  const folders = data.folders.filter((f) => !f.archived);
  const standalone = data.contacts
    .filter((c) => c.folderId === null && !c.archived)
    .sort(compareContacts);
  const archivedCount =
    data.folders.filter((f) => f.archived).length +
    data.contacts.filter((c) => c.archived).length;

  return (
    <div className="flex h-full flex-col select-none">
      {/* Namespace switcher — fixed. The framework component owns the
          collapsible section, the switchable rows, and the per-row drop
          targets (a contact or folder dragged onto another workspace's row
          moves into it); the cog opens the full namespaces manager. */}
      <NamespaceSwitcher
        namespaces={namespaces}
        activeNamespace={activeNamespace.slug}
        onSwitch={(slug) => {
          onSwitchNamespace(slug);
          onNavigate();
        }}
        onManage={onOpenNamespaces}
        dropZone={(slug) =>
          dnd.dropZone(`ns:${slug}`, { kind: "namespace", slug })
        }
        labels={{
          heading: t("menu.namespaces"),
          manage: t("namespaces.open"),
          switchTo: (name) => t("menu.switchToNamespace", { name }),
          expand: t("menu.showNamespaces"),
          collapse: t("menu.hideNamespaces"),
        }}
      />

      <SectionHeader label={t("menu.contacts")} border />

      {/* Scrolling list region — also the "root" drop target: dropping a card
          dragged out of a folder here un-groups it. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={rootZone.ref}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {creatingFolder && (
            <FolderEditRow
              placeholder={t("menu.folderName")}
              onCommit={(name) => {
                addFolder(name);
                setCreatingFolder(false);
              }}
              onCancel={() => setCreatingFolder(false)}
            />
          )}
          {folders.map((folder) => {
            const contacts = data.contacts
              .filter((c) => c.folderId === folder.id && !c.archived)
              .sort(compareContacts);
            const expanded = !collapsedFolders.has(folder.id);
            if (renamingFolderId === folder.id) {
              return (
                <FolderEditRow
                  key={folder.id}
                  initial={folder.name}
                  placeholder={t("menu.folderName")}
                  onCommit={(name) => {
                    renameFolder(folder.id, name);
                    setRenamingFolderId(null);
                  }}
                  onCancel={() => setRenamingFolderId(null)}
                />
              );
            }
            const renameFolderAction = {
              label: t("menu.renameFolder"),
              icon: <PencilIcon className="h-5 w-5" />,
              onSelect: () => setRenamingFolderId(folder.id),
            };
            const deleteFolderAction = {
              label: t("menu.deleteFolder"),
              icon: <TrashIcon className="h-5 w-5" />,
              danger: true,
              onSelect: () => deleteFolder(folder.id),
            };
            const folderActions = [renameFolderAction, deleteFolderAction];
            const folderMenuActions = [
              renameFolderAction,
              {
                label: t("menu.archive"),
                icon: <ArchiveIcon className="h-5 w-5" />,
                onSelect: () => archiveFolder(folder.id),
              },
              deleteFolderAction,
            ];
            const folderZone = dnd.dropZone(`folder:${folder.id}`, {
              kind: "folder",
              id: folder.id,
            });
            return (
              <div key={folder.id} ref={folderZone.ref}>
                <DraggableRow
                  handle={dnd.dragHandle({ kind: "folder", id: folder.id })}
                >
                  <RowActionMenu
                    ariaLabel={t("menu.folderActions")}
                    actions={folderMenuActions}
                    touchLongPress={false}
                  >
                    <SwipeableRow
                      actions={folderActions}
                      leading={{
                        kind: "commit",
                        onCommit: () => archiveFolder(folder.id),
                        label: t("menu.archive"),
                        icon: <ArchiveIcon className="h-5 w-5" />,
                      }}
                      highlighted={folderZone.isOver}
                    >
                      <FolderRow
                        name={folder.name}
                        addLabel={t("menu.newContactIn", {
                          name: folder.name,
                        })}
                        count={contacts.length}
                        expanded={expanded}
                        onToggle={() => toggleFolder(folder.id)}
                        onAdd={() => beginCreateContact(folder.id)}
                      />
                    </SwipeableRow>
                  </RowActionMenu>
                </DraggableRow>
                {expanded && (
                  <>
                    {contacts.map((contact) => renderContact(contact, true))}
                    {creatingContactIn === folder.id && (
                      <ContactEditRow
                        indent
                        placeholder={t("contact.fullNamePlaceholder")}
                        onCommit={(name) =>
                          commitCreateContact(folder.id, name)
                        }
                        onCancel={() => setCreatingContactIn(false)}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}

          {standalone.map((contact) => renderContact(contact, false))}
          {creatingContactIn === null && (
            <ContactEditRow
              indent={false}
              placeholder={t("contact.fullNamePlaceholder")}
              onCommit={(name) => commitCreateContact(null, name)}
              onCancel={() => setCreatingContactIn(false)}
            />
          )}
        </div>
        {/* "Drop here to ungroup" cue — floats above the rows, pinned to the
            visible region, click-through so it never swallows the drop. */}
        {rootZone.isOver && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-2 rounded-xl border-2 border-dashed border-accent bg-accent/10"
          />
        )}
      </div>

      {/* Action grid — fixed. */}
      <div className="shrink-0 px-3 pt-2 pb-3">
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line">
          <div className="flex divide-x divide-line">
            <BarButton
              buttonRef={newRef}
              label={t("menu.newContact")}
              onClick={() => beginCreateContact(null)}
            >
              <PlusIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.newFolder")}
              onClick={() => setCreatingFolder(true)}
            >
              <FolderIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.list")}
              onClick={onShowList}
              current={view === "list"}
            >
              <ListIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={dnd.dragging ? t("menu.dropToArchive") : t("menu.archive")}
              badge={archivedCount > 0 ? String(archivedCount) : undefined}
              onClick={onShowArchive}
              current={view === "archive"}
              dropRef={archiveZone.ref}
              over={archiveZone.isOver}
              active={archiveZone.isActive}
            >
              <ArchiveIcon className="h-5 w-5" />
            </BarButton>
          </div>
          <div className="flex divide-x divide-line">
            <BarButton
              label={t("menu.undo")}
              disabled={!canUndo}
              onClick={undo}
            >
              <UndoIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.redo")}
              disabled={!canRedo}
              onClick={redo}
            >
              <RedoIcon className="h-5 w-5" />
            </BarButton>
            <BarButton label={t("menu.search")} onClick={onOpenSearch}>
              <SearchIcon className="h-5 w-5" />
            </BarButton>
          </div>
        </div>
      </div>

      {/* Footer — fixed. Donate (an external link), the trophy, an About
          dropdown, the framework's "check for updates" row, and Settings
          pinned last under the thumb. */}
      <div className="flex shrink-0 flex-col border-t border-line [padding-top:calc(1.25rem-var(--density-row-py))]">
        <FooterLink
          icon={<HeartIcon className="h-5 w-5 text-danger" />}
          href={DONATE_URL}
          external
        >
          {t("menu.donate")}
        </FooterLink>
        {trophy}
        <button
          ref={aboutRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={aboutOpen}
          onClick={() => setAboutOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
        >
          <span className="text-muted">
            <HelpCircleIcon className="h-5 w-5" />
          </span>
          <span className="flex-1">{t("menu.about")}</span>
        </button>
        <CheckForUpdatesItem
          checking={checkingUpdate}
          updateAvailable={updateAvailable}
          onCheck={onCheckUpdate}
          labels={{
            idle: t("menu.checkUpdates"),
            checking: t("menu.checkingUpdates"),
            upToDate: t("menu.upToDate"),
            updateAvailable: t("menu.updateAvailable"),
            unavailable: t("menu.updatesUnavailable"),
          }}
        />
        <FooterRow
          icon={<CogIcon className="h-5 w-5" />}
          onClick={onOpenSettings}
        >
          {t("menu.settings")}
        </FooterRow>
      </div>

      {/* The About dropdown — portalled and positioned by the framework
          `FloatingPanel`. "What's new" opens the changelog dialog; "Source
          code" is an external link with the build label as its subtitle. */}
      <FloatingPanel
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        triggerRef={aboutRef}
        placement={ABOUT_PLACEMENT}
        className="py-1"
      >
        <FooterRow
          icon={<SparklesIcon className="h-5 w-5" />}
          onClick={() => {
            setAboutOpen(false);
            onOpenChangelog();
          }}
        >
          {t("menu.whatsNew")}
        </FooterRow>
        <FooterLink
          icon={<ExternalLinkIcon className="h-5 w-5" />}
          href={SOURCE_URL}
          sublabel={BUILD_LABEL}
          external
          onClick={() => setAboutOpen(false)}
        >
          {t("menu.source")}
        </FooterLink>
      </FloatingPanel>

      {/* The cursor-following label of whatever's mid-drag — portalled to the
          body so it rides above the drawer. */}
      {dnd.dragging && (
        <DragPreview
          item={dnd.dragging}
          pointer={dnd.pointer}
          contacts={data.contacts}
          folders={data.folders}
        />
      )}
    </div>
  );
}

// --- rows ------------------------------------------------------------------

function SectionHeader({ label, border }: { label: string; border?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-5 pt-3 pb-1 ${
        border ? "border-t border-line" : ""
      }`}
    >
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
    </div>
  );
}

function NavRow({
  children,
  icon,
  active,
  indent,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  active?: boolean;
  indent?: boolean;
  onClick?: () => void;
}) {
  const state = active
    ? "bg-accent/20 font-semibold text-fg-bright shadow-[inset_3px_0_0_var(--color-accent)]"
    : "text-fg hover:bg-surface-2 hover:text-fg-bright";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 py-[var(--density-row-py)] text-left text-sm ${
        indent ? "pr-5 pl-9" : "pr-5 pl-5"
      } ${state}`}
    >
      <span className={`shrink-0 ${active ? "text-accent" : "text-muted"}`}>
        {icon}
      </span>
      {children}
    </button>
  );
}

function FolderRow({
  name,
  addLabel,
  count,
  expanded,
  onToggle,
  onAdd,
}: {
  name: string;
  addLabel: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex w-full min-w-0 items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-[var(--density-row-py)] pr-1 pl-5 text-left text-fg hover:text-fg-bright"
      >
        <span className={expanded ? "text-accent" : "text-muted"}>
          {expanded ? (
            <FolderOpenIcon className="h-5 w-5" />
          ) : (
            <FolderIcon className="h-5 w-5" />
          )}
        </span>
        <span className="flex-1 truncate">{name}</span>
        <RowBadge value={count} />
      </button>
      <button
        type="button"
        onClick={onAdd}
        aria-label={addLabel}
        className="mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// The inline folder name editor, used both for creating a folder (empty) and
// renaming one (seeded with its name). The framework's `InlineEditRow` owns
// the focus-on-mount and Enter/blur-commits-Escape-cancels semantics.
function FolderEditRow({
  initial = "",
  placeholder,
  onCommit,
  onCancel,
}: {
  initial?: string;
  placeholder: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <InlineEditRow
      initial={initial}
      placeholder={placeholder}
      onCommit={onCommit}
      onCancel={onCancel}
      className="gap-3 pr-2 pl-5"
      icon={<FolderIcon className="h-5 w-5" />}
      iconClassName="text-muted"
    />
  );
}

// The inline "name your new contact" editor — dropped in the spot the card
// will land, wearing the neutral person mark.
function ContactEditRow({
  indent,
  placeholder,
  onCommit,
  onCancel,
}: {
  indent: boolean;
  placeholder: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <InlineEditRow
      initial=""
      placeholder={placeholder}
      onCommit={onCommit}
      onCancel={onCancel}
      className={`gap-3 ${indent ? "pr-5 pl-9" : "pr-5 pl-5"}`}
      icon={<PersonIcon className="h-4 w-4" />}
      iconClassName="text-muted"
    />
  );
}

function RowBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-xs text-muted tabular-nums">
      {value}
    </span>
  );
}

function BarButton({
  children,
  label,
  badge,
  disabled,
  onClick,
  current,
  dropRef,
  over,
  active,
  buttonRef,
}: {
  children: ReactNode;
  label: string;
  badge?: string;
  disabled?: boolean;
  onClick?: () => void;
  current?: boolean;
  dropRef?: (el: HTMLElement | null) => void;
  over?: boolean;
  active?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  // A live drag's drop-zone feedback wins over the resting "current view"
  // tint so the user can see where a dropped item will land.
  const dropState = over
    ? "bg-accent/30 text-fg-bright"
    : active
      ? "text-accent ring-1 ring-accent/40 ring-inset"
      : current
        ? "bg-accent/20 text-fg-bright"
        : "";
  return (
    <button
      ref={buttonRef ?? dropRef}
      type="button"
      aria-label={label}
      aria-pressed={current}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-1 items-center justify-center py-2.5 transition-colors ${
        disabled
          ? "cursor-not-allowed text-muted opacity-40"
          : "cursor-pointer text-fg hover:bg-surface-2 hover:text-fg-bright"
      } ${dropState}`}
    >
      <span className={over || current ? "text-fg-bright" : "text-muted"}>
        {children}
      </span>
      {badge !== undefined && (
        <span className="absolute top-0.5 right-0.5 rounded-full bg-surface-3 px-1 py-0.5 text-[10px] leading-none text-muted tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

// A draggable row: the whole row is the framework drag source. The framework
// hook splits the gesture by pointer (a mouse press-and-drags, a finger
// presses-and-holds to pick the row up) and owns the pointer once a drag
// begins. The wrapper opts out of the drawer's swipe-to-close so a horizontal
// drag here never doubles as a drawer dismiss.
function DraggableRow({
  handle,
  children,
}: {
  handle: DragHandleProps;
  children: ReactNode;
}) {
  return (
    <div {...handle} data-drawer-swipe-ignore className="relative">
      {children}
    </div>
  );
}

// The cursor-following drag preview — the dragged contact's / folder's icon
// and name, portalled to the body so it floats above everything.
function DragPreview({
  item,
  pointer,
  contacts,
  folders,
}: {
  item: DragItem;
  pointer: { x: number; y: number } | null;
  contacts: Contact[];
  folders: { id: string; name: string }[];
}) {
  if (!pointer) return null;
  const contact =
    item.kind === "contact" ? contacts.find((c) => c.id === item.id) : null;
  const folder =
    item.kind === "folder" ? folders.find((f) => f.id === item.id) : null;
  const label = contact ? displayName(contact) : (folder?.name ?? "");
  const icon = contact ? (
    <Avatar contact={contact} size="row" />
  ) : (
    <FolderIcon className="h-4 w-4" />
  );
  return createPortal(
    <div
      className="pointer-events-none fixed z-[60] flex max-w-[14rem] items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm text-fg-bright shadow-lg"
      style={{ left: pointer.x + 14, top: pointer.y + 14 }}
    >
      <span className="text-muted">{icon}</span>
      <span className="truncate">{label}</span>
    </div>,
    document.body,
  );
}

function FooterRow({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}

// The link sibling of `FooterRow` — an anchor instead of a button, with an
// optional subtitle (the Source row's build label) and an external-link
// affordance (a new tab + the trailing glyph).
function FooterLink({
  children,
  icon,
  href,
  sublabel,
  external,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  href: string;
  sublabel?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{children}</span>
        {sublabel && (
          <span className="truncate text-xs text-muted">{sublabel}</span>
        )}
      </span>
      {external && <ExternalLinkIcon className="h-4 w-4 shrink-0 text-muted" />}
    </a>
  );
}
