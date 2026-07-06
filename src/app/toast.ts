// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's toast surface — one module-level store shared between the code that
// raises a toast (contact import, and the favorite / archive / delete wrappers)
// and the single `AppToastViewport` rendered at the app root. Every confirmation
// in the app rides this one hovering pill (the look the contact-import banner
// used to own), so import, favorite, archive, and delete all read the same.
//
// It's app-owned rather than the framework's toast store because each entry
// carries its own leading icon and an optional Undo action — richer than the
// framework store's message + kind. The banner shows one message at a time, so a
// fresh push clears the stack first (see the call sites); auto-dismiss and
// pause-on-hover live in the viewport.

import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

/** How long the "archived / deleted — undo?" banner lingers, in ms. */
export const UNDO_TOAST_MS = 6000;
/** How long an informational banner (e.g. an import result) lingers, in ms. */
export const INFO_TOAST_MS = 4000;

/** The optional Undo (or similar) button on a toast. Activating it dismisses
 *  the toast. */
export type ToastAction = { label: string; onAction: () => void };

/** A toast the way the store holds it — an id plus everything a caller pushed. */
export type ToastEntry = {
  id: string;
  message: string;
  /** A small glyph shown at the leading edge (import ↑, archive, trash, …). */
  icon?: ReactNode;
  action?: ToastAction;
  /** Auto-dismiss delay in ms; a non-positive value makes it sticky. */
  durationMs: number;
};

/** What a caller hands `push` — a `ToastEntry` minus its generated id. */
export type ToastInput = Omit<ToastEntry, "id">;

let toasts: ToastEntry[] = [];
const listeners = new Set<() => void>();
let seq = 0;
const emit = () => listeners.forEach((fn) => fn());

export const toastStore = {
  /** Stack a toast and return its id. */
  push(input: ToastInput): string {
    const id = `toast-${++seq}`;
    toasts = [...toasts, { ...input, id }];
    emit();
    return id;
  },
  /** Remove one toast by id. A no-op for an unknown id. */
  dismiss(id: string): void {
    const next = toasts.filter((t) => t.id !== id);
    if (next.length === toasts.length) return;
    toasts = next;
    emit();
  },
  /** Remove every toast. */
  clear(): void {
    if (toasts.length === 0) return;
    toasts = [];
    emit();
  },
  /** The live stack — a stable reference until the next mutation. */
  getToasts(): ToastEntry[] {
    return toasts;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** Subscribe a component to the toast stack and re-render as it changes. */
export function useToasts(): ToastEntry[] {
  return useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getToasts,
    toastStore.getToasts,
  );
}
