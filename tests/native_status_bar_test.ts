// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The status bar over the page (`native/src/statusBar.ts`) and the theme
// report it is decided from (`native/src/injected.ts`).
//
// On iOS the page runs under the clock and the battery, so the icons have to
// be chosen from the page's own background: a dark theme needs light icons
// whatever the phone's light/dark setting says. Nothing here can be seen
// without a phone, so the reporter is RUN against a stand-in for the page and
// the decision is pinned colour by colour.

import { describe, expect, it } from "vitest";

import {
  AFTER_LOAD_SCRIPT,
  isReport,
  REPORT_TYPE,
} from "../native/src/injected.ts";
import { barStyleFor, parseColour } from "../native/src/statusBar.ts";

type Listener = () => void;

/** A stand-in page: `--page-bg` is whatever `vars` holds when read, and the
 *  hooks the reporter installs are captured so a test can fire them. */
function fakePage(vars: Record<string, string>) {
  const posted: string[] = [];
  const timers: Listener[] = [];
  const schemeListeners: Listener[] = [];
  const observers: Listener[] = [];
  const win: Record<string, unknown> = {
    ReactNativeWebView: { postMessage: (data: string) => posted.push(data) },
    matchMedia: () => ({
      addEventListener: (_: string, fn: Listener) => schemeListeners.push(fn),
    }),
  };
  const document = {
    documentElement: {},
    hidden: false,
    addEventListener: () => {},
  };
  const getComputedStyle = () => ({
    getPropertyValue: (name: string) => vars[name] ?? "",
  });
  class MutationObserver {
    constructor(fn: Listener) {
      observers.push(fn);
    }
    observe() {}
  }
  const setTimeout = (fn: Listener) => {
    timers.push(fn);
    return timers.length;
  };
  const clearTimeout = () => {};
  new Function(
    "window",
    "document",
    "getComputedStyle",
    "MutationObserver",
    "setTimeout",
    "clearTimeout",
    AFTER_LOAD_SCRIPT,
  )(
    win,
    document,
    getComputedStyle,
    MutationObserver,
    setTimeout,
    clearTimeout,
  );
  const flush = () => {
    while (timers.length) timers.shift()!();
  };
  return { posted, flush, schemeListeners, observers, win };
}

describe("the theme report", () => {
  it("posts the page background under the namespaced type", () => {
    const page = fakePage({ "--page-bg": "#010409" });
    expect(page.posted).toHaveLength(1);
    const message = JSON.parse(page.posted[0]!) as unknown;
    expect(isReport(message)).toBe(true);
    expect(message).toMatchObject({
      type: REPORT_TYPE,
      theme: { background: "#010409" },
    });
  });

  it("carries a hostile colour as data, never as code", () => {
    const hostile = `"});window.pwned=1;//</script>`;
    const page = fakePage({ "--page-bg": hostile });
    const message = JSON.parse(page.posted[0]!) as {
      theme: { background: string };
    };
    expect(message.theme.background).toBe(hostile);
    expect(page.win.pwned).toBeUndefined();
    expect(barStyleFor(message.theme.background)).toBe("auto");
  });

  it("reports again when the phone flips between light and dark", () => {
    // The "system" preset changes --page-bg through a media query, with no
    // <html> attribute changing for the observer to see.
    const vars = { "--page-bg": "#010409" };
    const page = fakePage(vars);
    page.flush();
    page.posted.length = 0;
    expect(page.schemeListeners).toHaveLength(1);
    vars["--page-bg"] = "#f6f8fa";
    page.schemeListeners[0]!();
    page.flush();
    const last = JSON.parse(page.posted.at(-1)!) as {
      theme: { background: string };
    };
    expect(last.theme.background).toBe("#f6f8fa");
  });

  it("installs once, however many times it is injected", () => {
    const page = fakePage({ "--page-bg": "#010409" });
    new Function("window", AFTER_LOAD_SCRIPT)(page.win);
    expect(page.observers).toHaveLength(1);
  });
});

describe("the status-bar style", () => {
  it("puts light icons on a dark background", () => {
    expect(barStyleFor("#010409")).toBe("light");
    expect(barStyleFor("#0b0d10")).toBe("light");
    expect(barStyleFor("rgb(29, 32, 39)")).toBe("light");
  });

  it("puts dark icons on a light background", () => {
    expect(barStyleFor("#f6f8fa")).toBe("dark");
    expect(barStyleFor("#fff")).toBe("dark");
    expect(barStyleFor("rgba(250, 244, 237, 1)")).toBe("dark");
  });

  it("keeps today's behaviour until there is a colour to read", () => {
    expect(barStyleFor(null)).toBe("auto");
    expect(barStyleFor(undefined)).toBe("auto");
    expect(barStyleFor("")).toBe("auto");
    expect(barStyleFor("var(--page-bg)")).toBe("auto");
  });

  it("reads every hex and rgb spelling the themes use", () => {
    expect(parseColour("#abc")).toEqual([170, 187, 204]);
    expect(parseColour("#aabbccdd")).toEqual([170, 187, 204]);
    expect(parseColour(" RGB(1 2 3 / 50%) ")).toEqual([1, 2, 3]);
    expect(parseColour("#12345")).toBeNull();
  });
});
