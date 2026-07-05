// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { UndoIcon } from "@niclaslindstedt/oss-framework/components";

// The hovering "action taken — undo?" toast, mirroring the import result banner
// (`ImportDropZone`): a pill that floats at the bottom of the content band after
// a contact / folder is archived or deleted, carrying the outcome and a one-tap
// Undo. It auto-dismisses on a timer the caller owns; the Undo button rewinds
// the last edit — the archive / delete that raised it. Positioned over the
// content band (not the whole viewport) via the sidebar-inset CSS variables, so
// it centres over the same strip the PWA update toast does.
export function ActionToast({
  message,
  undoLabel,
  onUndo,
}: {
  message: string;
  undoLabel: string;
  onUndo: () => void;
}) {
  return (
    <div
      className="pointer-events-none fixed right-[var(--app-content-right,0px)] bottom-[max(1rem,env(safe-area-inset-bottom))] left-[var(--app-content-left,0px)] z-[60] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-accent bg-surface-2 py-2 pr-2 pl-4 text-sm text-fg-bright shadow-lg">
        <span className="truncate">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 font-semibold text-accent hover:bg-accent/25"
        >
          <UndoIcon className="h-4 w-4" />
          {undoLabel}
        </button>
      </div>
    </div>
  );
}
