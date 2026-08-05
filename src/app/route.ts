// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// The app's route model — the slice of navigation state the browser's history
// remembers, and how it is spelled in the address bar.
//
// There is no router library and no server. The app is a static SPA whose
// *pathname* is already spoken for (the build serves the same bundle at
// `/privacy/` and `/home/`, which mount different pages — see `main.tsx`), and
// a made-up path like `/contact/abc` would 404 on GitHub Pages. So the route
// rides in the **hash**, where a reload, a bookmark, or a shared link always
// reaches `index.html` intact.
//
// Everything here is pure string work — the history plumbing that pushes and
// pops these routes lives in `useAppRoute.ts`.

/** The top-level screen the main area shows. */
export type AppView = "list" | "favorites" | "archive" | "contact";

/**
 * Where the app is. `contactId` is the open card: under `contact` it is the
 * full-page card (the way in from the sidebar or a search hit); under `list` /
 * `favorites` it is the card floating in the swipe-down modal over that browse
 * page. The `archive` screen never carries one.
 */
export type AppRoute = { view: AppView; contactId: string | null };

/** The app opens on the List page — the overview of every contact. */
export const DEFAULT_ROUTE: AppRoute = { view: "list", contactId: null };

const VIEWS: readonly AppView[] = ["list", "favorites", "archive", "contact"];

// A card only rides in the route on the screens that can actually show one.
function cardFor(view: AppView, id: string | null): string | null {
  return view === "archive" ? null : (id ?? null);
}

// `decodeURIComponent` throws on a malformed escape (`%zz`), and a hand-mangled
// address bar shouldn't take the app down — fall back to the raw segment.
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The `#/…` spelling of a route — what the address bar shows. */
export function formatRoute(route: AppRoute): string {
  const id = cardFor(route.view, route.contactId);
  return id ? `#/${route.view}/${encodeURIComponent(id)}` : `#/${route.view}`;
}

/**
 * Read a route back out of a `location.hash`. Tolerant by design: anything
 * unrecognised — an empty hash, a stale link, a hand-typed path — lands on the
 * default List page rather than throwing.
 */
export function parseRoute(hash: string): AppRoute {
  const [rawView = "", rawId = ""] = hash
    .replace(/^#/, "")
    .replace(/^\/+/, "")
    .split("/");
  const decoded = decode(rawView);
  const view = VIEWS.find((v) => v === decoded);
  if (!view) return DEFAULT_ROUTE;
  return { view, contactId: cardFor(view, rawId ? decode(rawId) : null) };
}

/**
 * A route's identity — two routes with the same key are the same place, so the
 * history plumbing can tell a real move from a re-render.
 */
export function routeKey(route: AppRoute): string {
  return formatRoute(route);
}
