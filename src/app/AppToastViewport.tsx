// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import { toastStore, useToasts, type ToastEntry } from "./toast.ts";

// The one toast surface for the whole app — the hovering pill the contact-import
// banner used to own, now shared by import, favorite, archive, and delete. It
// renders the `toastStore` stack as rounded pills at the bottom of the content
// band: a leading glyph, the message, and, when the toast carries one, an Undo
// button. The pill owns its own auto-dismiss timer and pauses it while the
// pointer rests on it, so there's time to reach the Undo.

export function AppToastViewport({ className }: { className?: string }) {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      className={
        className ??
        "pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4"
      }
    >
      {toasts.map((toast) => (
        <ToastPill key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastPill({ toast }: { toast: ToastEntry }) {
  const { id, message, icon, action, durationMs } = toast;
  // Pausing while hovered gives the pointer time to reach Undo; leaving restarts
  // the full window (a simpler, jitter-free stand-in for resuming the remainder).
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || durationMs <= 0) return;
    const timer = setTimeout(() => toastStore.dismiss(id), durationMs);
    return () => clearTimeout(timer);
  }, [id, durationMs, paused]);
  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-fg-bright shadow-lg"
    >
      {icon && <span className="shrink-0 text-accent">{icon}</span>}
      <span className="min-w-0 break-words">{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onAction();
            toastStore.dismiss(id);
          }}
          className="-mr-2 shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide text-accent hover:bg-surface-3"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
