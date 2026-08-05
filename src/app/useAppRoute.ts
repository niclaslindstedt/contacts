// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import { formatRoute, parseRoute, routeKey, type AppRoute } from "./route.ts";

// Keep the browser's history in step with where the app is.
//
// The app state stays the source of truth — the screens go on calling
// `setView` / `setActive` as they always have. This hook only *mirrors* the
// resulting place into the address bar: every move writes a history entry, so
// Back steps to the contact you were looking at before (and Forward returns),
// and a card opened over a browse page closes on the platform Back gesture the
// way a native sheet does.
//
// The reverse direction is `onPop`: a Back / Forward step hands the remembered
// route to the app, which applies it as state.

// What rides along with each entry, so a step back restores the exact place
// without having to re-read (and re-trust) the hash.
type RouteHistoryState = { appRoute?: AppRoute };

export function useAppRoute({
  route,
  canOpen,
  onPop,
}: {
  /** Where the app currently is, derived from its state. */
  route: AppRoute;
  /**
   * Whether a card can still be opened — false once it has been deleted or
   * archived. Moving *off* a card that just vanished is a fixup rather than a
   * navigation, so it rewrites the current entry instead of stacking one.
   */
  canOpen: (contactId: string) => boolean;
  /** Apply a route the user stepped back (or forward) to. */
  onPop: (route: AppRoute) => void;
}): void {
  // The callbacks are read from handlers and from an effect that must not
  // re-subscribe on every render, so they ride in a ref. This effect is
  // declared first, so it refreshes them before the sync effect below runs.
  const latest = useRef({ canOpen, onPop });
  useEffect(() => {
    latest.current = { canOpen, onPop };
  });

  // The place the history's current entry stands for, and the one before it.
  const entryKey = useRef(routeKey(route));
  const previous = useRef(route);
  // The first commit adopts the entry the page loaded on rather than stacking
  // a second one; a pop has already moved the history itself, so any fixup
  // after it rewrites that entry too.
  const adopting = useRef(true);
  const popped = useRef(false);

  useEffect(() => {
    const key = routeKey(route);
    const first = adopting.current;
    adopting.current = false;
    if (!first && key === entryKey.current) {
      // A re-render that didn't move: the entry already says this.
      popped.current = false;
      previous.current = route;
      return;
    }
    const vanished =
      previous.current.contactId !== null &&
      !latest.current.canOpen(previous.current.contactId);
    const rewrite = first || popped.current || vanished;
    popped.current = false;
    entryKey.current = key;
    previous.current = route;
    const state: RouteHistoryState = { appRoute: route };
    // A hash-only URL resolves against the current one, so the deploy path and
    // any query string (a Dropbox OAuth `?code=`, say) survive untouched.
    if (rewrite) window.history.replaceState(state, "", formatRoute(route));
    else window.history.pushState(state, "", formatRoute(route));
  }, [route]);

  useEffect(() => {
    // `popstate` covers Back / Forward (including the Android and iOS gestures);
    // `hashchange` covers a link or an address bar edit that jumps straight to
    // another `#/…`. Both land here, and the key check keeps the second one
    // that fires for a single step from re-applying it.
    const handle = (event: Event) => {
      const carried = (event as PopStateEvent)
        .state as RouteHistoryState | null;
      const next = carried?.appRoute ?? parseRoute(window.location.hash);
      const key = routeKey(next);
      if (key === entryKey.current) return;
      popped.current = true;
      entryKey.current = key;
      previous.current = next;
      latest.current.onPop(next);
    };
    window.addEventListener("popstate", handle);
    window.addEventListener("hashchange", handle);
    return () => {
      window.removeEventListener("popstate", handle);
      window.removeEventListener("hashchange", handle);
    };
  }, []);
}
