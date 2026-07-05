// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useId, useState, type ReactNode } from "react";

import {
  SegmentedControl,
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

// The private / work type toggle shared by phone and email rows — the
// framework `SegmentedControl` with a glyph per option (a person for private, a
// briefcase for work) in place of a dropdown. The wrapper captures the pointer
// press and cancels its default so tapping a glyph keeps an open value input
// focused: without it the mousedown would blur the field first — committing
// (and, for a fresh draft row, removing) it — before the click lands, forcing a
// defocus-then-click. Cancelling the focus shift lets a tap on the glyph flip
// the kind while the user is still typing.
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
  const glyph = (
    Icon: (p: { className?: string }) => ReactNode,
    text: string,
  ) => (
    <span className="flex h-4 items-center">
      <Icon className="h-4 w-4" />
      <span className="sr-only">{text}</span>
    </span>
  );
  return (
    <div className="shrink-0" onMouseDownCapture={(e) => e.preventDefault()}>
      <SegmentedControl<ContactMethodKind>
        value={kind}
        ariaLabel={ariaLabel}
        onChange={onChange}
        options={[
          {
            value: "private",
            label: glyph(PersonIcon, t("contact.kindPrivate")),
          },
          { value: "work", label: glyph(BuildingIcon, t("contact.kindWork")) },
        ]}
      />
    </div>
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
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-danger/10 hover:text-danger"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
