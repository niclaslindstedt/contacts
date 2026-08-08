// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Hook backing the developer "Fake data" and "Demo data" toggles. When a mode
// is active, the contact store loads a throwaway in-memory document — the
// edge-case fake sample (`buildFakeData`) or the presentation-grade demo book
// (`buildDemoData`) — instead of the real localStorage address book; see
// `App`'s backend swap. The two toggles share one mode, so they are mutually
// exclusive: turning one on turns the other off. Turning both off restores the
// real document; the user's data is never touched, because seeded data is
// never written back.
//
// The mode is deliberately IN-MEMORY ONLY — module scope, no localStorage
// write — so a page reload always drops back to the real backend. That makes
// reload the guaranteed escape hatch: seeded data can never outlive the tab.
//
// The one exception is the initial value: it's seeded from the `VITE_SEED`
// build-time variable. Setting `VITE_SEED` (e.g. `VITE_SEED=large npm run
// dev`, or `VITE_SEED=demo`) boots the app straight into that mode, so the dev
// server always comes up full of data. Because the module re-reads the env on
// every load, a reload keeps that seed — but a plain build (no `VITE_SEED`)
// starts inactive as usual.
//
// State lives at module scope with a pub/sub layer so the toggles in the
// Developer tab and the store swap in `App` see the same value in the same
// render — flipping a toggle updates both immediately. Modelled on the
// checklist project's `useDevSeed`.

import { useEffect, useState } from "react";

import {
  parseSeedEnv,
  type DevDataMode,
  type FakeSeedSize,
} from "./seedMode.ts";

// The seeded backends and the data builders behind them are a dev-only
// luxury, so they ride in their own chunk: nothing on the entry path imports
// `seedBackend.ts` / `fakeData.ts` / `demoData.ts` statically, and the chunk
// is fetched only when a mode actually turns on.
type SeedBackends = typeof import("./seedBackend.ts");
let backends: SeedBackends | null = null;

/** The loaded backend factories, or `null` while no mode has ever been on.
 *  `App` reads this synchronously — `setDevDataMode` guarantees the chunk has
 *  landed before it flips `mode` off "off". */
export function seedBackends(): SeedBackends | null {
  return backends;
}

// Read the build-time seed intent once. `VITE_SEED` is only ever set for local
// dev / preview builds; a normal production build leaves it unset, so the mode
// starts "off" and `size` is the harmless default.
const initial = parseSeedEnv(import.meta.env.VITE_SEED as string | undefined);

// Demo mode starts "off" even when `VITE_SEED=demo` asked for it: the portrait
// chunk has to arrive first (see `setDevDataMode`), and the kick-off at the
// bottom of this module flips the mode on as soon as it has.
// Always starts "off", whatever `VITE_SEED` asked for: the builders live in
// their own chunk now, so *every* mode has to wait for it. The kick-off at the
// bottom of this module requests the real initial mode, which lands a tick
// later once the chunk is in.
let mode: DevDataMode = "off";
// The fake-data size is fixed by the env for the whole session: the manual
// toggle reuses whatever `VITE_SEED` asked for (or the curated sample when
// it's unset), so turning the switch off and on again rebuilds the same
// dataset. The demo document has exactly one size — its whole point.
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

// Monotonic token so a slow demo-photo load can't overwrite a newer choice:
// each call claims the sequence, and a stale async flip aborts.
let seq = 0;

/** Switch the in-memory dataset mode. Nothing is persisted. Flipping into
 *  demo mode is asynchronous under the hood: the portrait photos live in
 *  their own lazy chunk (kept out of the main bundle — ~290 KB of JPEG that
 *  production users shouldn't parse on boot), so the mode flips once that
 *  chunk has loaded and the demo document can seed complete with faces. */
export function setDevDataMode(next: DevDataMode): void {
  const token = ++seq;
  if (mode === next) return;
  if (next === "off") {
    mode = "off";
    notify();
    return;
  }
  // Turning a mode ON is asynchronous under the hood: the builders live in
  // their own chunk, and demo mode additionally waits on the ~290 KB portrait
  // chunk so its document seeds complete with faces. The mode flips only once
  // everything it needs has landed, so `App` can build the backend
  // synchronously from that render on.
  void import("./seedBackend.ts")
    .then(async (m) => {
      backends = m;
      if (next === "demo") await m.loadDemoPhotos();
    })
    .then(() => {
      // A later call (toggled away while loading) wins over this one.
      if (token !== seq) return;
      mode = next;
      notify();
    });
}

// The `VITE_SEED` boot path: request the deferred flip now, so the dev server
// lands on the seeded document as soon as the dev chunk (and, for demo mode,
// the portrait chunk) is in.
if (initial.mode !== "off") setDevDataMode(initial.mode);

export function useDevSeed(): {
  mode: DevDataMode;
  size: FakeSeedSize;
  setMode: (next: DevDataMode) => void;
} {
  const [, force] = useState(0);

  useEffect(() => {
    const cb = () => force((v) => v + 1);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  return { mode, size, setMode: setDevDataMode };
}
