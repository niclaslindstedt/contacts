// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useState } from "react";

// A `useState` drop-in backed by localStorage: read once on mount (safe
// parse, merging a stored partial over the defaults for plain objects),
// write-through on every set. The app's small persisted stores (settings,
// namespaces, achievements) all sit on this one hook.

export type LocalStorageStateOptions<T> = {
  /** Turn the stored string into a value. Defaults to JSON.parse, merging a
   *  stored partial over `initial` when both are plain objects. */
  parse?: (raw: string) => T;
  /** Turn a value into the stored string. Defaults to JSON.stringify. */
  serialize?: (value: T) => string;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function useLocalStorageState<T>(
  key: string,
  initial: T,
  options: LocalStorageStateOptions<T> = {},
): [T, (next: T | ((prev: T) => T)) => void] {
  const { parse, serialize } = options;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        if (parse) return parse(raw);
        const parsed = JSON.parse(raw) as unknown;
        if (isPlainObject(initial) && isPlainObject(parsed)) {
          return { ...initial, ...parsed } as T;
        }
        return parsed as T;
      }
    } catch {
      // Corrupt or unavailable storage — fall back to the defaults.
    }
    return initial;
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(
            key,
            serialize ? serialize(resolved) : JSON.stringify(resolved),
          );
        } catch {
          // Storage full / unavailable — the in-memory state still works.
        }
        return resolved;
      });
    },
    // `serialize` is a stable module-level function at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, set];
}
