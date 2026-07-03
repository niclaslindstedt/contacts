// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Hook backing the developer "Fake data" toggle. When active, the contact
// store loads a throwaway sample document (`buildFakeData`) into memory instead
// of the real localStorage address book — see `useContactStore`'s fake-seed
// path. Turning it off restores the real document; the user's data is never
// touched, because fake data is never written back.
//
// The flag is deliberately IN-MEMORY ONLY — module scope, no localStorage
// write — so a page reload always drops back to the real backend. That makes
// reload the guaranteed escape hatch: fake data can never outlive the tab.
//
// The one exception is the initial value: it's seeded from the `VITE_SEED`
// build-time variable. Setting `VITE_SEED` (e.g. `VITE_SEED=large npm run dev`)
// boots the app straight into fake-data mode with a big varied dataset, so the
// dev server always comes up full of test data to shake out edge cases. Because
// the module re-reads the env on every load, a reload keeps that seed — but a
// plain build (no `VITE_SEED`) starts inactive as usual.
//
// State lives at module scope with a pub/sub layer so the toggle in the
// Developer tab and the store swap in `App` see the same value in the same
// render — flipping the toggle updates both immediately. Modelled on the
// checklist project's `useDevSeed`.

import { useEffect, useState } from "react";

import { parseSeedEnv, type FakeSeedSize } from "./fakeData.ts";

// Read the build-time seed intent once. `VITE_SEED` is only ever set for local
// dev / preview builds; a normal production build leaves it unset, so `active`
// starts false and `size` is the harmless default.
const initial = parseSeedEnv(import.meta.env.VITE_SEED as string | undefined);

let active = initial.active;
// The size is fixed by the env for the whole session: the manual toggle reuses
// whatever `VITE_SEED` asked for (or the curated sample when it's unset), so
// turning the switch off and on again rebuilds the same dataset.
const size: FakeSeedSize = initial.size;

const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) {
    try {
      cb();
    } catch {
      // A subscriber throwing must not break the dispatch loop.
    }
  }
}

/** Flip fake-data mode on or off. In-memory only — nothing is persisted. */
export function setFakeData(next: boolean): void {
  if (active === next) return;
  active = next;
  notify();
}

export function useDevSeed(): {
  active: boolean;
  size: FakeSeedSize;
  setActive: (next: boolean) => void;
} {
  const [, force] = useState(0);

  useEffect(() => {
    const cb = () => force((v) => v + 1);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  return { active, size, setActive: setFakeData };
}
