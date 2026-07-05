// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The developer in-memory storage backends. This is how "Fake data" and
// "Demo data" work: instead of a special case inside the store, an in-memory
// backend *takes over* document storage while a toggle is on (the same shape
// the checklist project uses — an ephemeral `StorageAdapter` swapped in ahead
// of the real one).
//
// Every namespace is seeded from the given builder on first load; edits made
// during the session round-trip through an in-memory `Map`, so undo/redo, the
// active-card pointer, and cross-namespace moves all behave exactly as they do
// against the real backend — but nothing is ever written to localStorage. The
// backend is discarded when the toggle flips off or the page reloads, at which
// point `App` feeds the real `localDocBackend` back and the untouched document
// on disk reloads.

import type { AppData } from "../types.ts";
import type { DocBackend } from "../useContactStore.ts";
import { buildDemoData } from "./demoData.ts";
import { buildFakeData, type FakeSeedSize } from "./fakeData.ts";

// The shared mechanics: an in-memory backend that seeds each namespace lazily
// from `build` on first access, so switching workspaces during a seeded
// session lands on its own populated address book.
function createMemoryBackend(build: () => AppData): DocBackend {
  const docs = new Map<string, AppData>();

  return {
    id: "dev",
    load(slug) {
      let doc = docs.get(slug);
      if (!doc) {
        doc = build();
        docs.set(slug, doc);
      }
      return doc;
    },
    save(slug, doc) {
      // In-memory only — the whole point is that the real disk is never touched.
      docs.set(slug, doc);
    },
  };
}

/** Build a fresh in-memory fake-data backend. A new one is created each time
 *  the toggle is turned on (so each enable starts from a pristine sample); the
 *  `size` fixes how much data every namespace is seeded with. */
export function createSeedBackend(size: FakeSeedSize): DocBackend {
  return createMemoryBackend(() => buildFakeData({ size }));
}

/** Build a fresh in-memory demo-data backend — the presentation-grade address
 *  book from `demoData.ts`, one fixed size. */
export function createDemoBackend(): DocBackend {
  return createMemoryBackend(buildDemoData);
}
