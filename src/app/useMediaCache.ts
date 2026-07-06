// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import { logStore } from "./log.ts";
import {
  deleteCachedMedia,
  desiredMedia,
  readCachedMedia,
  recordsToMediaSource,
  writeCachedMedia,
  type MediaRecord,
} from "./mediaCache.ts";
import type { MediaSource } from "./mediaHydrate.ts";
import type { AppData } from "./types.ts";

// Keeps the on-device IndexedDB media cache in step with the working document,
// and seeds the document from it on open. Two effects:
//
//   1. On mount (and namespace switch) read the cache and re-hydrate the working
//      copy's missing photo / attachment bytes — so a cold restart shows the
//      pictures immediately, before (and without needing) any drive round-trip.
//   2. On every settled edit, mirror the document's inline media into the cache
//      (new / changed bytes written, removed entries deleted), so what the next
//      open reads back is current.
//
// The cache is a best-effort accelerator, never a source of truth: the drive
// copy still owns cross-device sync, and every IndexedDB call degrades to a
// no-op where the API is absent. See `mediaCache.ts`.

const log = logStore.createLogger("photos");

const SYNC_DEBOUNCE_MS = 800;

/** A short fingerprint of a data URI, so an unchanged blob isn't re-written to
 *  IndexedDB on every edit — only genuinely new bytes are put. */
function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i);
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

export function useMediaCache(
  // Off while the developer fake-data / demo backend has taken over storage, so
  // a throwaway sample's photos never land in the cache and the cache never
  // seeds a sample — it mirrors only the real, on-disk address book.
  enabled: boolean,
  slug: string,
  data: AppData,
  hydrateMediaFrom: (remote: MediaSource) => void,
): void {
  // key → fingerprint of what the cache is believed to hold, so the change-sync
  // effect writes and deletes only the delta. Reset when the namespace changes.
  const synced = useRef(new Map<string, string>());

  // 1. Seed the working copy from the cache on open / namespace switch.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    synced.current = new Map();
    void (async () => {
      const records = await readCachedMedia(slug);
      if (cancelled || records.length === 0) return;
      hydrateMediaFrom(recordsToMediaSource(records));
      for (const r of records) synced.current.set(r.key, fingerprint(r.data));
      log.info(
        `cache: hydrated ${records.length} media blob(s) from IndexedDB`,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, slug, hydrateMediaFrom]);

  // 2. Mirror the document's inline media into the cache after each settled edit.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      const desired = desiredMedia(slug, data);
      const desiredKeys = new Set(desired.map((r) => r.key));
      const toPut: MediaRecord[] = desired.filter(
        (r) => synced.current.get(r.key) !== fingerprint(r.data),
      );
      const toDelete = [...synced.current.keys()].filter(
        (k) => !desiredKeys.has(k),
      );
      if (toPut.length > 0) {
        void writeCachedMedia(toPut);
        for (const r of toPut) synced.current.set(r.key, fingerprint(r.data));
      }
      if (toDelete.length > 0) {
        void deleteCachedMedia(toDelete);
        for (const k of toDelete) synced.current.delete(k);
      }
    }, SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, slug, data]);
}
