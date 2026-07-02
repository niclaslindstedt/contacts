// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef } from "react";

import { useLocalStorageState } from "./useLocalStorageState.ts";

// The app's achievements store — the seam the framework leaves to the app:
// where earned trophies live. The framework's watcher calls `record` and reads
// `unlocked`; this hook owns the ledger, the unseen queue that lights the
// trophy button, and *where* the map lives (a localStorage key). A green-field
// app starts with everything locked — there is no retroactive backfill here.

type Persisted = {
  // id → unlock timestamp.
  unlocked: Record<string, number>;
  // Earned but not yet acknowledged — drives the button badge + unlock modal.
  unseen: string[];
};

const STORAGE_KEY = "contacts:achievements";

const EMPTY: Persisted = { unlocked: {}, unseen: [] };

export type AchievementsStore = ReturnType<typeof useAchievements>;

export function useAchievements() {
  const [p, setP] = useLocalStorageState<Persisted>(STORAGE_KEY, EMPTY);
  const ref = useRef(p);
  ref.current = p;

  // The watcher's writer: record ids idempotently, queue the genuinely new
  // ones as unseen, and return them synchronously (React setState is
  // fire-and-forget, so derive fresh from the ref).
  const record = useCallback(
    (ids: readonly string[]): string[] => {
      const fresh = ids.filter((id) => ref.current.unlocked[id] === undefined);
      if (fresh.length === 0) return [];
      const now = Date.now();
      setP((prev) => {
        const unlocked = { ...prev.unlocked };
        const unseen = [...prev.unseen];
        for (const id of fresh) {
          if (unlocked[id] !== undefined) continue;
          unlocked[id] = now;
          if (!unseen.includes(id)) unseen.push(id);
        }
        return { unlocked, unseen };
      });
      return fresh;
    },
    [setP],
  );

  const clearUnseen = useCallback(() => {
    setP((prev) => (prev.unseen.length ? { ...prev, unseen: [] } : prev));
  }, [setP]);

  return {
    unlocked: p.unlocked,
    unseen: p.unseen,
    record,
    clearUnseen,
  };
}
