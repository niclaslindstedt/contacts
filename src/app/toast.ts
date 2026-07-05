// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's toast surface — one module-level framework store shared between
// the code that raises a toast (the archive / delete wrappers in `App.tsx`)
// and the single `ToastViewport` rendered at the app root. The undo banner
// shows one message at a time, so a fresh push clears the stack first (see
// `App.tsx`); the store itself is the framework's.

import { createToastStore } from "@niclaslindstedt/oss-framework/components";

/** How long the "archived / deleted — undo?" banner lingers, in ms. */
export const UNDO_TOAST_MS = 6000;

export const toastStore = createToastStore();
