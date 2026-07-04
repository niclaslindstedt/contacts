// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { type ReactNode, type RefObject } from "react";

import {
  ExternalLinkIcon,
  FolderIcon,
  FolderOpenIcon,
  InlineEditRow,
  PlusIcon,
} from "@niclaslindstedt/oss-framework/components";

import { PersonIcon } from "./icons.tsx";

// The side menu's presentational leaf rows — the dumb building blocks the
// stateful `SideMenuContent` composes: section headings, folder / contact
// rows, the inline name editors, the action-grid buttons, and the footer
// rows. Kept out of `SideMenuContent.tsx` so that file stays about the
// navigation's state and gestures, not its pixels (and under the §20.5 size
// cap). Everything here is a pure function of its props.

// Folder nesting indent. Rows sit at a base left pad (the `pl-5` baseline) plus
// one step per level, so a subfolder — and the cards inside it — step further
// right the deeper they're filed.
const ROW_BASE_PAD_REM = 1.25;
const INDENT_STEP_REM = 1;

/** The left padding for a row nested `level` deep (0 = top level). */
export function rowIndentPad(level: number): string {
  return `${ROW_BASE_PAD_REM + level * INDENT_STEP_REM}rem`;
}

/** A leading spacer that indents an inline-edit row to `level`, matching the
 *  padding the folder / contact rows carry. `null` at the top level. */
export function indentSpacer(level: number): ReactNode {
  return level > 0 ? (
    <span
      aria-hidden
      className="shrink-0"
      style={{ width: `${level * INDENT_STEP_REM}rem` }}
    />
  ) : null;
}

export function SectionHeader({
  label,
  border,
  action,
}: {
  label: string;
  border?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-5 pt-3 pb-1 ${
        border ? "border-t border-line" : ""
      }`}
    >
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      {action}
    </div>
  );
}

// The glyph seated at the right of the "Contacts" header row: one click folds
// every folder shut, the next unfolds them all. Its icon mirrors the folder
// rows' own convention — an open folder means "there's something to collapse",
// a closed one means "expand".
export function CollapseAllButton({
  collapsed,
  label,
  onClick,
}: {
  collapsed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
    >
      {collapsed ? (
        <FolderIcon className="h-4 w-4" />
      ) : (
        <FolderOpenIcon className="h-4 w-4" />
      )}
    </button>
  );
}

export function NavRow({
  children,
  icon,
  active,
  indentLevel = 0,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  active?: boolean;
  // Nesting depth of the row: 0 for a root contact, folder-depth + 1 for a card
  // inside a (possibly nested) folder. Drives the left indent.
  indentLevel?: number;
  onClick?: () => void;
}) {
  const state = active
    ? "bg-accent/20 font-semibold text-fg-bright shadow-[inset_3px_0_0_var(--color-accent)]"
    : "text-fg hover:bg-surface-2 hover:text-fg-bright";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingLeft: rowIndentPad(indentLevel) }}
      className={`flex w-full cursor-pointer items-center gap-3 py-[var(--density-row-py)] pr-5 text-left text-sm ${state}`}
    >
      <span className={`shrink-0 ${active ? "text-accent" : "text-muted"}`}>
        {icon}
      </span>
      {children}
    </button>
  );
}

export function FolderRow({
  name,
  addLabel,
  count,
  expanded,
  indentLevel = 0,
  onToggle,
  onAdd,
}: {
  name: string;
  addLabel: string;
  count: number;
  expanded: boolean;
  indentLevel?: number;
  onToggle: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex w-full min-w-0 items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{ paddingLeft: rowIndentPad(indentLevel) }}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-[var(--density-row-py)] pr-1 text-left text-sm text-fg hover:text-fg-bright"
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
export function FolderEditRow({
  initial = "",
  placeholder,
  indentLevel = 0,
  onCommit,
  onCancel,
}: {
  initial?: string;
  placeholder: string;
  indentLevel?: number;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <InlineEditRow
      initial={initial}
      placeholder={placeholder}
      onCommit={onCommit}
      onCancel={onCancel}
      leading={indentSpacer(indentLevel)}
      className="gap-3 pr-2 pl-5"
      icon={<FolderIcon className="h-5 w-5" />}
      iconClassName="text-muted"
    />
  );
}

// The inline "name your new contact" editor — dropped in the spot the card
// will land, wearing the neutral person mark.
export function ContactEditRow({
  indentLevel,
  placeholder,
  onCommit,
  onCancel,
}: {
  indentLevel: number;
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
      leading={indentSpacer(indentLevel)}
      className="gap-3 pr-5 pl-5"
      icon={<PersonIcon className="h-4 w-4" />}
      iconClassName="text-muted"
    />
  );
}

export function RowBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-xs text-muted tabular-nums">
      {value}
    </span>
  );
}

export function BarButton({
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

export function FooterRow({
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
export function FooterLink({
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
