// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

import {
  ArchiveIcon,
  CogIcon,
  ExternalLinkIcon,
  FloatingPanel,
  FolderIcon,
  FolderOpenIcon,
  HelpCircleIcon,
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
  type FloatingPoint,
} from "@niclaslindstedt/oss-framework/components";
import {
  NamespaceSwitcher,
  type Namespace,
} from "@niclaslindstedt/oss-framework/namespaces";
import {
  CheckForUpdatesItem,
  type PwaUpdateCheckResult,
} from "@niclaslindstedt/oss-framework/pwa";
import { useDragDrop } from "@niclaslindstedt/oss-framework/sidebar";

import { Avatar } from "./Avatar.tsx";
import {
  canNestFolder,
  childrenByParent,
  emergencyContacts,
  reorderIds,
  subtreeFolderIds,
} from "./contactList.ts";
import { FavoriteIcon, IceIcon, ListIcon } from "./icons.tsx";
import { MoveToFolderMenu } from "./MoveToFolderMenu.tsx";
import {
  BarButton,
  CollapseAllButton,
  ContactEditRow,
  DraggableRow,
  DragPreview,
  FolderEditRow,
  FolderRow,
  FooterCollapseRail,
  FooterLink,
  FooterRow,
  NavRow,
  SectionHeader,
} from "./SideMenuRows.tsx";
import { useT } from "./i18n/index.ts";
import { useLocalStorageState } from "./useLocalStorageState.ts";
import type { FolderSort } from "./useAppSettings.ts";
import type { ContactStore } from "./useContactStore.ts";
import type { Contact, Folder } from "./types.ts";
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
  // The active top-level view — highlights the List / Favorites / Archive
  // buttons when their page shows.
  view: "contact" | "archive" | "list" | "favorites";
  onShowArchive: () => void;
  // Open the overview List page (all contacts, grouped by folder).
  onShowList: () => void;
  // Open the Favorites page (starred contacts, same folder-grouped layout).
  onShowFavorites: () => void;
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
  // How the folder rows are ordered. `alphabetical` sorts them by name;
  // `manual` keeps the hand-dragged order and turns on folder drag-to-reorder.
  folderSort: FolderSort;
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
  onShowFavorites,
  checkingUpdate,
  updateAvailable,
  onCheckUpdate,
  trophy,
  folderSort,
}: Props) {
  const t = useT();
  const {
    data,
    addContact,
    addFolder,
    moveFolderToFolder,
    reorderFolders,
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
  const manualFolders = folderSort === "manual";

  // The folder tree. Archived folders drop out of the menu (the Archive counter
  // tallies them); what's left is walked into a depth-first, depth-annotated
  // reading order — each subfolder immediately under its parent — plus a
  // parent-of lookup the collapse / reorder / nest logic reads.
  const visibleFolders = data.folders.filter((f) => !f.archived);
  const byParent = childrenByParent(visibleFolders, folderSort);
  const parentOf = new Map<string, string | null>();
  for (const [parent, kids] of byParent)
    for (const kid of kids) parentOf.set(kid.id, parent);
  const siblingIdsOf = (folderId: string): string[] =>
    (byParent.get(parentOf.get(folderId) ?? null) ?? []).map((f) => f.id);

  // Drag-and-drop wiring. The framework hook tracks the gesture and hit-tests
  // the drop zones; the app says which drops are legal (`canDrop`) and what
  // each one means (`onDrop`) — reparent into a folder or back to the root,
  // hand a contact / folder to another namespace, or archive it.
  const dnd = useDragDrop<DragItem, DropTarget>({
    onDraggingChange,
    canDrop: (drag, target) => {
      switch (target.kind) {
        case "folder":
          // A folder dropped onto another folder either **nests** into it or
          // **reorders** beside it — legal as long as it isn't dropped on itself
          // or into its own subtree (which would sever a cycle). A contact
          // dropped onto any folder files into it, its current one included (a
          // harmless no-op, so a card can always be returned home).
          if (drag.kind === "folder") {
            return canNestFolder(visibleFolders, drag.id, target.id);
          }
          return data.contacts.some((c) => c.id === drag.id);
        case "root":
          // The root un-groups a dragged contact or lifts a subfolder back to
          // the top level.
          return drag.kind === "folder"
            ? visibleFolders.some((f) => f.id === drag.id)
            : data.contacts.some((c) => c.id === drag.id);
        case "namespace":
          return true;
        case "archive":
          return true;
      }
    },
    onDrop: (drag, target) => {
      switch (target.kind) {
        case "folder":
          if (drag.kind === "folder") {
            // The pointer's third of the target row (captured in `folderDropRef`)
            // decides between nesting into the folder and reordering beside it:
            // the middle nests, the edges slot before / after among siblings.
            const pending = folderDropRef.current;
            const place =
              pending?.targetId === target.id ? pending.place : "into";
            if (place === "into") {
              moveFolderToFolder(drag.id, target.id);
            } else {
              reorderFolders(
                reorderIds(pending!.siblingIds, drag.id, target.id, place),
              );
            }
          } else {
            moveContactToFolder(drag.id, target.id);
          }
          break;
        case "root":
          if (drag.kind === "folder") moveFolderToFolder(drag.id, null);
          else moveContactToFolder(drag.id, null);
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
  // Folder drag bookkeeping: the folder header elements (to measure which third
  // of a row the pointer sits over) and the pending drop — its target, whether
  // the pointer is nesting `into` the folder or slotting `before` / `after` it,
  // and the sibling id order a reorder rearranges. Refs so the hook's `onDrop`
  // reads current values rather than a stale render's.
  const folderRowEls = useRef(new Map<string, HTMLElement>());
  const folderDropRef = useRef<{
    targetId: string;
    place: "before" | "into" | "after";
    siblingIds: string[];
  } | null>(null);
  const archiveZone = dnd.dropZone("archive", { kind: "archive" });
  const rootZone = dnd.dropZone("root", { kind: "root" });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  // The "Move to folder" right-click submenu. `movePointer` captures where the
  // row was right-clicked (recorded in the capture phase, before the row's
  // action menu opens) so the folder picker opens there; `movePicker` holds
  // what's being moved once that action is chosen.
  const movePointer = useRef<FloatingPoint>({ x: 0, y: 0 });
  const [movePicker, setMovePicker] = useState<{
    kind: "contact" | "folder";
    id: string;
    at: FloatingPoint;
  } | null>(null);
  // A new folder isn't created until it's named: the "New folder" action drops
  // an inline editor into the list, and only a non-empty name commits it. The
  // value is the parent the folder will nest under — `null` for a root folder
  // (the "New folder" bar button), a folder id for a subfolder (a folder's "New
  // subfolder" action), or `false` when nothing is being created.
  const [creatingFolderIn, setCreatingFolderIn] = useState<
    string | null | false
  >(false);
  // A new contact follows the same pattern: the "New" button (root) or a
  // folder's "+" drops an inline editor in the spot the card will land, and
  // only a non-empty name commits it. `null` when none is being created.
  const [creatingContactIn, setCreatingContactIn] = useState<
    string | null | false
  >(false);
  // The folder / contact whose name is being edited in place, or `null`.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  // The footer (Donate / trophy / About / update / Settings) can be folded
  // away with the thin chevron rail above it, freeing the space for the
  // contact list. The choice is remembered across reloads and applies on
  // every viewport — the phone drawer offers the same collapse control.
  const [footerCollapsed, setFooterCollapsed] = useLocalStorageState(
    "contacts:footer-collapsed",
    false,
  );
  const footerHidden = footerCollapsed;
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

  // Collapse every folder in one go (or, once they're all collapsed, expand
  // them all again). Driven by the glyph on the "Contacts" header row.
  function setAllFoldersCollapsed(collapsed: boolean, ids: string[]) {
    setCollapsedFolders(collapsed ? new Set(ids) : new Set());
  }

  function pick(id: string) {
    setActive(id);
    onNavigate();
  }

  // Expand a folder if it's collapsed — so an inline editor dropped inside it
  // (a new contact or a new subfolder) is actually visible.
  function ensureExpanded(folderId: string) {
    setCollapsedFolders((prev) => {
      if (!prev.has(folderId)) return prev;
      const next = new Set(prev);
      next.delete(folderId);
      return next;
    });
  }

  // Open the inline "name your new contact" editor. A card created inside a
  // folder needs that folder expanded so the editor is visible.
  function beginCreateContact(folderId: string | null) {
    if (folderId !== null) ensureExpanded(folderId);
    setCreatingContactIn(folderId);
  }

  // Open the inline "name your new folder" editor. A subfolder needs its parent
  // expanded so the editor shows.
  function beginCreateFolder(parentId: string | null) {
    if (parentId !== null) ensureExpanded(parentId);
    setCreatingFolderIn(parentId);
  }

  function commitCreateContact(folderId: string | null, fullName: string) {
    addContact(folderId, fullName);
    setCreatingContactIn(false);
    onNavigate();
  }

  // One contact row at nesting `indentLevel` (0 at the root, folder-depth + 1
  // inside a folder). A swipeable nav row — swipe left for the trash strip
  // (delete), swipe right to archive. A desktop pointer reaches the same actions
  // through the right-click menu.
  function renderContact(contact: Contact, indentLevel: number) {
    const deleteAction = {
      label: t("menu.deleteContact"),
      icon: <TrashIcon className="h-5 w-5" />,
      danger: true,
      onSelect: () => deleteContact(contact.id),
    };
    // Filing the card into a folder from the right-click menu — an alternative
    // to dragging it there. Offered whenever there's somewhere to move it: a
    // folder to file into, or (for a filed card) the root to lift it back to.
    const canMoveContact =
      visibleFolders.length > 0 || contact.folderId !== null;
    const moveContactAction = {
      label: t("menu.moveToFolder"),
      icon: <FolderOpenIcon className="h-5 w-5" />,
      onSelect: () =>
        setMovePicker({
          kind: "contact",
          id: contact.id,
          at: movePointer.current,
        }),
    };
    // The emergency flag is a set-once-ever choice, so it lives only in the
    // card's edit view (a toggle at the bottom) — not cluttering the per-row
    // right-click menu. The pinned ICE badge below still shows the state.
    const menuActions = [
      ...(canMoveContact ? [moveContactAction] : []),
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
              indentLevel={indentLevel}
              active={active}
              icon={<Avatar contact={contact} size="row" />}
              onClick={() => pick(contact.id)}
            >
              <span className="flex-1 truncate">
                {displayName(contact) || (
                  <span className="text-muted">{t("contact.unnamed")}</span>
                )}
              </span>
              {contact.ice && (
                <IceIcon
                  className="h-4 w-4 shrink-0 text-danger"
                  aria-label={t("menu.iceContact")}
                />
              )}
            </NavRow>
          </SwipeableRow>
        </RowActionMenu>
      </DraggableRow>
    );
  }

  // One folder row and, when it's expanded, its subtree: its subfolders first
  // (each rendered the same way, one level deeper), then the folder's own
  // contacts — so a nested folder sits right under its parent's header rather
  // than below a long list of the parent's cards. A collapsed folder renders
  // just its row, folding the whole subtree away with it.
  function renderFolderNode(folder: Folder, depth: number): ReactNode {
    const contacts = data.contacts
      .filter((c) => c.folderId === folder.id && !c.archived)
      .sort(compareContacts);
    const children = byParent.get(folder.id) ?? [];
    const expanded = !collapsedFolders.has(folder.id);
    if (renamingFolderId === folder.id) {
      return (
        <FolderEditRow
          key={folder.id}
          initial={folder.name}
          indentLevel={depth}
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
    const newSubfolderAction = {
      label: t("menu.newSubfolder"),
      icon: <FolderIcon className="h-5 w-5" />,
      onSelect: () => beginCreateFolder(folder.id),
    };
    // Nest this folder under another (or lift it to the root) from the menu —
    // the drag gesture's counterpart. Its own subtree is excluded as a target
    // (a folder can't nest inside itself), so it's offered only when a legal
    // destination exists.
    const folderSubtree = subtreeFolderIds(visibleFolders, folder.id);
    const canMoveFolder =
      (folder.parentId ?? null) !== null ||
      visibleFolders.some((f) => !folderSubtree.has(f.id));
    const moveFolderAction = {
      label: t("menu.moveToFolder"),
      icon: <FolderOpenIcon className="h-5 w-5" />,
      onSelect: () =>
        setMovePicker({
          kind: "folder",
          id: folder.id,
          at: movePointer.current,
        }),
    };
    const deleteFolderAction = {
      label: t("menu.deleteFolder"),
      icon: <TrashIcon className="h-5 w-5" />,
      danger: true,
      onSelect: () => deleteFolder(folder.id),
    };
    const folderActions = [
      renameFolderAction,
      newSubfolderAction,
      deleteFolderAction,
    ];
    const folderMenuActions = [
      renameFolderAction,
      newSubfolderAction,
      ...(canMoveFolder ? [moveFolderAction] : []),
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
    // What a folder dragged over this one does, picked from the pointer's third
    // of the row: the middle **nests** into the folder (a "file into"
    // highlight), the top / bottom edges **reorder** it before / after among its
    // siblings (a thin insertion line). Reordering only applies in manual sort
    // and only between siblings — otherwise the whole row nests. The pointer's
    // position is mirrored into the drop ref that `onDrop` reads.
    const draggingFolderId =
      dnd.dragging?.kind === "folder" ? dnd.dragging.id : null;
    let showFolderLine = false;
    let folderLineBelow = false;
    let nestHighlight = false;
    if (
      draggingFolderId !== null &&
      draggingFolderId !== folder.id &&
      folderZone.isOver &&
      dnd.pointer
    ) {
      const rect = folderRowEls.current.get(folder.id)?.getBoundingClientRect();
      if (rect) {
        const sameParent =
          (parentOf.get(draggingFolderId) ?? null) ===
          (parentOf.get(folder.id) ?? null);
        const canReorder = manualFolders && sameParent;
        const frac = (dnd.pointer.y - rect.top) / rect.height;
        let place: "before" | "into" | "after" = "into";
        if (canReorder && frac < 0.25) place = "before";
        else if (canReorder && frac > 0.75) place = "after";
        if (place === "into") {
          nestHighlight = canNestFolder(
            visibleFolders,
            draggingFolderId,
            folder.id,
          );
        } else {
          showFolderLine = true;
          folderLineBelow = place === "after";
        }
        folderDropRef.current = {
          targetId: folder.id,
          place,
          siblingIds: siblingIdsOf(folder.id),
        };
      }
    }
    return (
      <div key={folder.id} ref={folderZone.ref} className="relative">
        {showFolderLine && (
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-accent ${
              folderLineBelow ? "bottom-0" : "top-0"
            }`}
          />
        )}
        <DraggableRow
          handle={dnd.dragHandle({ kind: "folder", id: folder.id })}
          containerRef={(el) => {
            if (el) folderRowEls.current.set(folder.id, el);
            else folderRowEls.current.delete(folder.id);
          }}
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
              // Filing a contact into this folder, or nesting a folder into it,
              // lights the row up; a folder-reorder drag shows the insertion
              // line instead.
              highlighted={
                folderZone.isOver &&
                (dnd.dragging?.kind === "contact" || nestHighlight)
              }
            >
              <FolderRow
                name={folder.name}
                addLabel={t("menu.newContactIn", { name: folder.name })}
                count={contacts.length}
                expanded={expanded}
                indentLevel={depth}
                onToggle={() => toggleFolder(folder.id)}
                onAdd={() => beginCreateContact(folder.id)}
              />
            </SwipeableRow>
          </RowActionMenu>
        </DraggableRow>
        {expanded && (
          <>
            {creatingFolderIn === folder.id && (
              <FolderEditRow
                indentLevel={depth + 1}
                placeholder={t("menu.subfolderName")}
                onCommit={(name) => {
                  addFolder(name, folder.id);
                  setCreatingFolderIn(false);
                }}
                onCancel={() => setCreatingFolderIn(false)}
              />
            )}
            {children.map((child) => renderFolderNode(child, depth + 1))}
            {contacts.map((contact) => renderContact(contact, depth + 1))}
            {creatingContactIn === folder.id && (
              <ContactEditRow
                indentLevel={depth + 1}
                placeholder={t("contact.fullNamePlaceholder")}
                onCommit={(name) => commitCreateContact(folder.id, name)}
                onCancel={() => setCreatingContactIn(false)}
              />
            )}
          </>
        )}
      </div>
    );
  }

  // The root-level folders — the top of the tree `renderFolderNode` descends.
  const rootFolders = byParent.get(null) ?? [];

  // Drives the "Contacts" header glyph: once every folder is collapsed the
  // button flips to "expand all", otherwise it collapses them all.
  const allFoldersCollapsed =
    visibleFolders.length > 0 &&
    visibleFolders.every((f) => collapsedFolders.has(f.id));
  const standalone = data.contacts
    .filter((c) => c.folderId === null && !c.archived)
    .sort(compareContacts);
  // Emergency contacts are pinned to the very top of the list, mirrored out of
  // wherever they're filed so they're always the first thing in reach.
  const emergency = emergencyContacts(data);
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

      <SectionHeader
        label={t("menu.contacts")}
        border
        action={
          visibleFolders.length > 0 ? (
            <CollapseAllButton
              collapsed={allFoldersCollapsed}
              label={
                allFoldersCollapsed
                  ? t("menu.expandAllFolders")
                  : t("menu.collapseAllFolders")
              }
              onClick={() =>
                setAllFoldersCollapsed(
                  !allFoldersCollapsed,
                  visibleFolders.map((f) => f.id),
                )
              }
            />
          ) : undefined
        }
      />

      {/* Scrolling list region — also the "root" drop target: dropping a card
          dragged out of a folder here un-groups it. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={rootZone.ref}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          // Record where a right-click lands (capture phase, before the row's
          // action menu opens) so the "Move to folder" submenu can open there.
          onContextMenuCapture={(e) => {
            movePointer.current = { x: e.clientX, y: e.clientY };
          }}
        >
          {/* Pinned "in case of emergency" section — flagged contacts float to
              the top, mirrored from their folder so they're always in reach. */}
          {emergency.length > 0 && (
            <div className="border-b border-line pb-1">
              <div className="flex items-center gap-2 px-5 pt-3 pb-1">
                <IceIcon className="h-4 w-4 text-danger" />
                <span className="text-xs font-semibold tracking-wide text-danger uppercase">
                  {t("menu.emergency")}
                </span>
              </div>
              {emergency.map((contact) => renderContact(contact, 0))}
            </div>
          )}
          {creatingFolderIn === null && (
            <FolderEditRow
              placeholder={t("menu.folderName")}
              onCommit={(name) => {
                addFolder(name);
                setCreatingFolderIn(false);
              }}
              onCancel={() => setCreatingFolderIn(false)}
            />
          )}
          {rootFolders.map((folder) => renderFolderNode(folder, 0))}

          {standalone.map((contact) => renderContact(contact, 0))}
          {creatingContactIn === null && (
            <ContactEditRow
              indentLevel={0}
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
              onClick={() => beginCreateFolder(null)}
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
              label={t("menu.favorites")}
              onClick={onShowFavorites}
              current={view === "favorites"}
            >
              <FavoriteIcon className="h-5 w-5" filled={view === "favorites"} />
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
        </div>
      </div>

      {/* Footer collapse rail. A thin, full-width chevron button seated just
          above the footer that folds it away (and back), so the contact list
          can claim the freed vertical space. Offered on every viewport,
          including the phone drawer. */}
      <FooterCollapseRail
        collapsed={footerCollapsed}
        label={
          footerCollapsed ? t("menu.expandFooter") : t("menu.collapseFooter")
        }
        onClick={() => setFooterCollapsed((v) => !v)}
      />

      {/* Footer — fixed. Donate (an external link), the trophy, an About
          dropdown, the framework's "check for updates" row, and Settings
          pinned last under the thumb. Foldable away via the rail above. */}
      {!footerHidden && (
        <div className="flex shrink-0 flex-col border-t border-line [padding-top:calc(1.25rem-var(--density-row-py))]">
          <FooterLink
            icon={<FavoriteIcon filled className="h-5 w-5 text-danger" />}
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
      )}

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
      {dnd.dragging &&
        (() => {
          // Resolve what's mid-drag into a label + glyph for the floating
          // preview: a contact's avatar and name, or a folder's icon and name.
          const drag = dnd.dragging;
          const contact =
            drag.kind === "contact"
              ? data.contacts.find((c) => c.id === drag.id)
              : null;
          const folder =
            drag.kind === "folder"
              ? data.folders.find((f) => f.id === drag.id)
              : null;
          return (
            <DragPreview
              pointer={dnd.pointer}
              label={contact ? displayName(contact) : (folder?.name ?? "")}
              icon={
                contact ? (
                  <Avatar contact={contact} size="row" />
                ) : (
                  <FolderIcon className="h-4 w-4" />
                )
              }
            />
          );
        })()}

      {/* The "Move to folder" right-click submenu — a folder picker opened at
          the pointer, filing the chosen contact / folder. A moving folder's own
          subtree is excluded so it can't be nested inside itself. */}
      <MoveToFolderMenu
        folders={visibleFolders}
        folderSort={folderSort}
        position={movePicker ? movePicker.at : null}
        excludeFolderIds={
          movePicker?.kind === "folder"
            ? subtreeFolderIds(visibleFolders, movePicker.id)
            : undefined
        }
        onMove={(folderId) => {
          if (!movePicker) return;
          if (movePicker.kind === "contact") {
            moveContactToFolder(movePicker.id, folderId);
          } else {
            moveFolderToFolder(movePicker.id, folderId);
          }
          setMovePicker(null);
        }}
        onClose={() => setMovePicker(null)}
      />
    </div>
  );
}

// --- rows ------------------------------------------------------------------
//
// The presentational leaf rows — including the drag-coupled `DraggableRow` /
// `DragPreview` and the `FooterCollapseRail` — all live in `SideMenuRows.tsx`,
// so this file stays about the navigation's state and gestures.
