// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  BuildingIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PersonIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";
import type { ContactMethodKind } from "./types.ts";

// The app-domain building blocks of the edit form, lifted out of
// `ContactEditView` so that file stays under the source-size cap: the private /
// work kind toggle and the trash affordance that drops a row. The generic
// pieces the form once carried here (the labelled inputs, the glyph-titled
// section) are the framework's now — `LabeledInput`, `LabeledTextarea`, and
// `Section` (with its `icon` slot) from its components module.

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

// A stacked up/down pair for hand-ordering a list of rows (the important-date
// list uses it). The two chevrons sit tight in one column so they cost little
// row width; each disables itself at the end of the list it can't move past, so
// the top row can't move up and the bottom row can't move down.
export function ReorderButtons({
  upLabel,
  downLabel,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  upLabel: string;
  downLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const btn =
    "flex h-3.5 w-7 cursor-pointer items-center justify-center text-muted hover:text-fg disabled:cursor-default disabled:opacity-30 disabled:hover:text-muted";
  return (
    <span className="flex shrink-0 flex-col">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label={upLabel}
        title={upLabel}
        className={btn}
      >
        <ChevronUpIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label={downLabel}
        title={downLabel}
        className={btn}
      >
        <ChevronDownIcon className="h-4 w-4" />
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
