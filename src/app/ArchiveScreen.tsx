// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  FolderIcon,
  RestoreIcon,
  RowActionMenu,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";
import { useDesktopPointer } from "@niclaslindstedt/oss-framework/hooks";

import { Avatar } from "./Avatar.tsx";
import { useT } from "./i18n/index.ts";
import type { ContactStore } from "./useContactStore.ts";
import type { Contact } from "./types.ts";
import { compareContacts, displayName } from "./types.ts";

// The Archive page — the second top-level view, reached from the side menu's
// Archive button (the same button a contact or folder is dragged onto to
// archive it). Read-mostly: nothing is created here, things only arrive by
// being archived elsewhere. It holds the two things the document can shelve:
//
//   • Archived **folders**, each restorable or deletable as a whole —
//     restoring brings the folder and every contact it carried back into the
//     menu; deleting drops them for good.
//   • Archived **contacts** that were shelved on their own, each restorable
//     or deletable individually.

export function ArchiveScreen({ store }: { store: ContactStore }) {
  const t = useT();
  const {
    data,
    unarchiveFolder,
    deleteArchivedFolder,
    unarchiveContact,
    deleteContact,
  } = store;
  const desktop = useDesktopPointer();
  // Which archived folders the user has collapsed. Default-expanded — local
  // view state, it doesn't travel with the document.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleFolder = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const archivedFolders = data.folders.filter((f) => f.archived);
  const archivedFolderIds = new Set(archivedFolders.map((f) => f.id));
  // Contacts shelved on their own — archived, but not swept up by an archived
  // folder (those are restored / deleted at the folder level instead).
  const archivedContacts = data.contacts
    .filter((c) => c.archived && !archivedFolderIds.has(c.folderId ?? ""))
    .sort(compareContacts);
  const count =
    archivedFolders.length + data.contacts.filter((c) => c.archived).length;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <header className="mb-2 flex items-center gap-3 border-b border-line px-1 pb-3">
        <ArchiveIcon className="h-5 w-5 shrink-0 text-muted" />
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-wide text-fg-bright">
          {t("archive.title")}
        </h1>
        <span className="shrink-0 text-sm text-muted tabular-nums">
          {count}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-10 [overscroll-behavior:contain]">
        {count === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted">
            {t("archive.empty")}
          </p>
        ) : (
          <>
            {archivedFolders.length > 0 && (
              <section className="mb-2">
                <SectionLabel>{t("archive.folders")}</SectionLabel>
                <ul className="m-0 list-none p-0">
                  {archivedFolders.map((folder) => {
                    const members = data.contacts.filter(
                      (c) => c.folderId === folder.id,
                    );
                    const isCollapsed = collapsed.has(folder.id);
                    return (
                      <li key={folder.id}>
                        <ArchiveRow
                          title={folder.name}
                          icon={<FolderIcon className="h-4 w-4" />}
                          count={members.length}
                          expanded={
                            members.length > 0 ? !isCollapsed : undefined
                          }
                          onToggle={
                            members.length > 0
                              ? () => toggleFolder(folder.id)
                              : undefined
                          }
                          desktop={desktop}
                          restoreLabel={t("archive.restoreFolder")}
                          onRestore={() => unarchiveFolder(folder.id)}
                          onDelete={() => deleteArchivedFolder(folder.id)}
                        />
                        {members.length > 0 && !isCollapsed && (
                          <ul className="m-0 list-none p-0">
                            {members.map((contact) => (
                              <li
                                key={contact.id}
                                className="flex min-h-9 items-center gap-3 border-b border-line py-1.5 pr-3 pl-11"
                              >
                                <Avatar contact={contact} size="row" />
                                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                                  {contactTitle(contact, t("contact.unnamed"))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {archivedContacts.length > 0 && (
              <section className="mb-2">
                <SectionLabel>{t("archive.contacts")}</SectionLabel>
                <ul className="m-0 list-none p-0">
                  {archivedContacts.map((contact) => (
                    <li key={contact.id}>
                      <ArchiveRow
                        title={contactTitle(contact, t("contact.unnamed"))}
                        icon={<Avatar contact={contact} size="row" />}
                        desktop={desktop}
                        restoreLabel={t("archive.restoreContact")}
                        onRestore={() => unarchiveContact(contact.id)}
                        onDelete={() => deleteContact(contact.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function contactTitle(contact: Contact, unnamed: string): string {
  return displayName(contact) || unnamed;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wider text-muted uppercase first:pt-1">
      {children}
    </h2>
  );
}

// One archive row — a folder header or a standalone contact. The leading area
// is a disclosure toggle when `onToggle` is supplied (a folder with members),
// otherwise a plain icon. Restore / delete reach the user two ways, split by
// pointer: a desktop right-click opens the framework `RowActionMenu`; touch
// keeps the inline buttons.
function ArchiveRow({
  title,
  icon,
  count,
  expanded,
  onToggle,
  desktop,
  restoreLabel,
  onRestore,
  onDelete,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  expanded?: boolean;
  onToggle?: () => void;
  desktop: boolean;
  restoreLabel: string;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const actions = [
    {
      label: restoreLabel,
      icon: <RestoreIcon className="h-5 w-5" />,
      onSelect: onRestore,
    },
    {
      label: t("archive.delete"),
      icon: <TrashIcon className="h-5 w-5" />,
      danger: true,
      onSelect: onDelete,
    },
  ];

  const leading =
    onToggle && expanded !== undefined ? (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={title}
        className="-my-2 -ml-1 flex shrink-0 cursor-pointer items-center gap-2 self-stretch py-2 pr-1 pl-1 text-muted hover:text-fg"
      >
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
        <span aria-hidden>{icon}</span>
      </button>
    ) : (
      <span className="shrink-0 text-muted">{icon}</span>
    );

  return (
    <RowActionMenu
      ariaLabel={t("archive.rowActions")}
      actions={actions}
      enabled={desktop}
    >
      <div className="flex min-h-11 items-center gap-3 border-b border-line px-3 py-2">
        {leading}
        <span className="min-w-0 flex-1 truncate text-fg">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="shrink-0 text-xs text-muted tabular-nums">
            {count}
          </span>
        )}
        {!desktop && (
          <>
            <button
              type="button"
              onClick={onRestore}
              aria-label={restoreLabel}
              title={restoreLabel}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
            >
              <RestoreIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("archive.delete")}
              title={t("archive.delete")}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-danger/10 hover:text-danger"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </RowActionMenu>
  );
}
