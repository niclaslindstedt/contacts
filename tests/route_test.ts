// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROUTE,
  formatRoute,
  parseRoute,
  routeKey,
  type AppRoute,
} from "../src/app/route.ts";

// The route is the app's whole navigation contract with the browser: what the
// address bar says, what a bookmark reopens, and what a Back step restores.
// These cover the spelling both ways and the tolerance a hand-typed (or stale)
// hash needs.

describe("formatRoute", () => {
  it("spells a browse screen as its own segment", () => {
    expect(formatRoute({ view: "list", contactId: null })).toBe("#/list");
    expect(formatRoute({ view: "favorites", contactId: null })).toBe(
      "#/favorites",
    );
    expect(formatRoute({ view: "archive", contactId: null })).toBe("#/archive");
  });

  it("names the open card", () => {
    expect(formatRoute({ view: "list", contactId: "contact_7" })).toBe(
      "#/list/contact_7",
    );
    expect(formatRoute({ view: "favorites", contactId: "contact_7" })).toBe(
      "#/favorites/contact_7",
    );
  });

  it("drops a card the archive screen can't show", () => {
    expect(formatRoute({ view: "archive", contactId: "contact_7" })).toBe(
      "#/archive",
    );
  });

  it("escapes an id that would otherwise break the path", () => {
    expect(formatRoute({ view: "list", contactId: "a/b c" })).toBe(
      "#/list/a%2Fb%20c",
    );
  });
});

describe("parseRoute", () => {
  it("reads back everything formatRoute writes", () => {
    const routes: AppRoute[] = [
      { view: "list", contactId: null },
      { view: "favorites", contactId: null },
      { view: "archive", contactId: null },
      { view: "list", contactId: "contact_7" },
      { view: "favorites", contactId: "a/b c" },
    ];
    for (const route of routes) {
      expect(parseRoute(formatRoute(route))).toEqual(route);
    }
  });

  it("opens on the List page for a URL with no hash", () => {
    expect(parseRoute("")).toEqual(DEFAULT_ROUTE);
    expect(parseRoute("#")).toEqual(DEFAULT_ROUTE);
    expect(parseRoute("#/")).toEqual(DEFAULT_ROUTE);
  });

  it("falls back to the List page rather than throwing on nonsense", () => {
    expect(parseRoute("#/nowhere")).toEqual(DEFAULT_ROUTE);
    expect(parseRoute("#/nowhere/contact_7")).toEqual(DEFAULT_ROUTE);
    expect(parseRoute("#/%zz")).toEqual(DEFAULT_ROUTE);
  });

  it("survives a malformed escape in the id", () => {
    expect(parseRoute("#/list/%zz")).toEqual({
      view: "list",
      contactId: "%zz",
    });
  });

  it("tolerates a missing or doubled leading slash", () => {
    expect(parseRoute("#archive")).toEqual({
      view: "archive",
      contactId: null,
    });
    expect(parseRoute("#//list/contact_7")).toEqual({
      view: "list",
      contactId: "contact_7",
    });
  });

  it("ignores trailing junk past the id", () => {
    expect(parseRoute("#/list/contact_7/edit")).toEqual({
      view: "list",
      contactId: "contact_7",
    });
  });

  // The card used to be a screen of its own; those links are still in
  // bookmarks and history, and now land where the same tap lands today — the
  // List page with that card floating over it.
  it("reads a legacy `#/contact/<id>` link as the card over the List page", () => {
    expect(parseRoute("#/contact/contact_7")).toEqual({
      view: "list",
      contactId: "contact_7",
    });
    expect(parseRoute("#/contact")).toEqual(DEFAULT_ROUTE);
  });

  it("drops a card the archive screen can't show", () => {
    expect(parseRoute("#/archive/contact_7")).toEqual({
      view: "archive",
      contactId: null,
    });
  });
});

describe("routeKey", () => {
  it("matches two routes that stand for the same place", () => {
    expect(routeKey({ view: "list", contactId: "contact_7" })).toBe(
      routeKey({ view: "list", contactId: "contact_7" }),
    );
    expect(routeKey({ view: "archive", contactId: "contact_7" })).toBe(
      routeKey({ view: "archive", contactId: null }),
    );
  });

  it("separates the same card open over two different browse pages", () => {
    expect(routeKey({ view: "favorites", contactId: "contact_7" })).not.toBe(
      routeKey({ view: "list", contactId: "contact_7" }),
    );
  });
});
