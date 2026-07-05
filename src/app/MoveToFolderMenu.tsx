// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  ContextMenu,
  FolderIcon,
  FolderOpenIcon,
  type FloatingPoint,
  type RowAction,
} from "@niclaslindstedt/oss-framework/components";

import { orderedFolderTree } from "./contactList.ts";
import { useT } from "./i18n/index.ts";
import type { FolderSort } from "./useAppSettings.ts";
import type { Folder } from "./types.ts";

// An em space — indents nested folder labels. A regular leading space collapses
// in HTML, so the flat menu items would all line up; the em space survives.
const EM_SPACE = " ";

// The "Move to folder" dropdown — the folder tree laid out as a flat, indented
// menu (each subfolder stepped in under its parent), led by a "No folder" entry
// that lifts the item(s) back to the root. Picking one files everything the
// menu was opened for into that folder. A thin wrapper over the framework
// `ContextMenu`, anchored at the pointer where the row was right-clicked, so it
// reads as a genuine right-click submenu. Shared by the side menu (a contact or
// a folder) and the List page (one contact, or the whole selection).
export function MoveToFolderMenu({
  folders,
  folderSort,
  position,
  excludeFolderIds,
  onMove,
  onClose,
}: {
  // The folders that can be picked — already filtered to the non-archived set.
  folders: readonly Folder[];
  folderSort: FolderSort;
  // The pointer point to open at, or `null` when the menu is closed.
  position: FloatingPoint | null;
  // Folder ids to leave out of the list — a folder being moved can't land in
  // its own subtree, so the caller passes that subtree here.
  excludeFolderIds?: ReadonlySet<string>;
  // Chosen destination — a folder id, or `null` for the root ("No folder").
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const t = useT();
  const tree = orderedFolderTree(folders, folderSort).filter(
    ({ folder }) => !excludeFolderIds?.has(folder.id),
  );
  const actions: RowAction[] = [
    {
      label: t("menu.noFolder"),
      icon: <FolderOpenIcon className="h-5 w-5" />,
      onSelect: () => onMove(null),
    },
    ...tree.map(({ folder, depth }) => ({
      label: `${EM_SPACE.repeat(depth)}${folder.name}`,
      icon: <FolderIcon className="h-5 w-5" />,
      onSelect: () => onMove(folder.id),
    })),
  ];
  return (
    <ContextMenu
      position={position}
      actions={actions}
      onClose={onClose}
      ariaLabel={t("menu.moveToFolderMenu")}
    />
  );
}
