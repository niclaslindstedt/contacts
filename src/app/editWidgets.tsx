// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useId, useState, type ReactNode } from "react";

import {
  TrashIcon,
  type IconProps,
} from "@niclaslindstedt/oss-framework/components";

import { BuildingIcon, PersonIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import type { ContactMethodKind } from "./types.ts";

// The shared building blocks of the edit form, lifted out of `ContactEditView`
// so that file stays under the source-size cap: the labelled inputs every
// section reuses, the trash affordance that drops a row, and the glyph-titled
// section wrapper the edit form draws in place of the framework's plain
// `Section`.

// A bordered, glyph-titled group — the framework `Section`'s look (see its
// markup), but with a leading mark on the caption so each block of the edit
// form scans at a glance. The framework `Section` takes only a string title
// (no glyph slot), so the edit form draws this app-local twin, marking its
// sections with the same glyphs the read view wears on its rows.
export function IconSection({
  icon: Icon,
  title,
  children,
}: {
  icon: (p: IconProps) => ReactNode;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="mt-3 rounded border border-line bg-surface-3 p-3 first:mt-0"
    >
      <div
        id={titleId}
        className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase"
      >
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full min-w-0 max-w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent";

// A labelled single-line field that holds its draft locally and commits on
// blur (or Enter) — so a settled edit is one undoable store step, not a
// commit per keystroke.
export function LabeledInput({
  label,
  value,
  type = "text",
  placeholder,
  required = false,
  invalid = false,
  onCommit,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  // `required` flags the field as mandatory (a11y + a marker on the label);
  // `invalid` paints the border and sets `aria-invalid` when the value is
  // missing, so the caller drives the error state it wants to show.
  required?: boolean;
  invalid?: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        required={required}
        aria-invalid={invalid || undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={invalid ? `${inputClass} border-danger` : inputClass}
      />
    </label>
  );
}

export function LabeledTextarea({
  label,
  hideLabel = false,
  value,
  rows,
  placeholder,
  onCommit,
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  rows: number;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {!hideLabel && <span className="text-xs text-muted">{label}</span>}
      <textarea
        aria-label={hideLabel ? label : undefined}
        value={draft}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        className={`${inputClass} resize-y`}
      />
    </label>
  );
}

// The private / work type toggle shared by phone and email rows. A method is
// one or the other, never both, so this is a single button that swaps between
// the two glyphs (a person for private, a briefcase for work) on each tap
// rather than a two-segment control that spends row width showing the option
// you're *not* on. The current kind tints the button (work in accent) and the
// swap animates via `transition-colors`. The wrapper captures the pointer press
// and cancels its default so tapping keeps an open value input focused: without
// it the mousedown would blur the field first — committing (and, for a fresh
// draft row, removing) it — before the click lands. Cancelling the focus shift
// lets a tap flip the kind while the user is still typing.
export function KindToggle({
  kind,
  ariaLabel,
  onChange,
}: {
  kind: ContactMethodKind;
  ariaLabel: string;
  onChange: (next: ContactMethodKind) => void;
}) {
  const t = useT();
  const isWork = kind === "work";
  const Icon = isWork ? BuildingIcon : PersonIcon;
  // The accessible name pairs the control's purpose with its current value, so a
  // screen reader announces e.g. "Number type: Work"; the tap flips it to the
  // other kind.
  const label = `${ariaLabel}: ${isWork ? t("contact.kindWork") : t("contact.kindPrivate")}`;
  return (
    <span className="shrink-0" onMouseDownCapture={(e) => e.preventDefault()}>
      <button
        type="button"
        onClick={() => onChange(isWork ? "private" : "work")}
        aria-label={label}
        title={label}
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition-colors hover:border-accent ${
          isWork
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-line bg-surface-2 text-muted hover:text-fg"
        }`}
      >
        <Icon className="h-4 w-4" />
      </button>
    </span>
  );
}

// The shared trash affordance — a red-on-hover icon button that drops a row.
export function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-danger/10 hover:text-danger"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
