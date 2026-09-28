// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, describe, expect, it, vi } from "vitest";

import { isStandaloneMobile } from "@niclaslindstedt/oss-framework/pwa";

import { swipeOpensMenu } from "../src/app/menuMode.ts";

// The edge-swipe setting is gated on the framework's standalone detector,
// which counts the phone app's WebView as standalone: a phone browser tab
// does not offer it, the shell does. The tests run in node, so the page's
// `window` and `navigator` are stubbed per case.

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

function onPhone(win: Record<string, unknown>) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), ...win });
  vi.stubGlobal("navigator", { userAgent: IPHONE_UA, maxTouchPoints: 5 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("swipeOpensMenu", () => {
  it("swipes only when chosen, standalone and not docked", () => {
    expect(swipeOpensMenu("swipe", { pinned: false, standalone: true })).toBe(
      true,
    );
    expect(swipeOpensMenu("button", { pinned: false, standalone: true })).toBe(
      false,
    );
    expect(swipeOpensMenu("swipe", { pinned: true, standalone: true })).toBe(
      false,
    );
  });

  it("falls back to the button in a browser tab, whatever was stored", () => {
    expect(swipeOpensMenu("swipe", { pinned: false, standalone: false })).toBe(
      false,
    );
  });
});

describe("the gate the setting is offered behind", () => {
  it("is closed in a phone's browser tab", () => {
    onPhone({});
    expect(isStandaloneMobile()).toBe(false);
  });

  it("opens in the phone app's react-native-webview shell", () => {
    onPhone({ ReactNativeWebView: { postMessage: () => {} } });
    expect(isStandaloneMobile()).toBe(true);
  });

  it("opens in a shell that injects its descriptor", () => {
    onPhone({ __ossShell: { version: 1, capabilities: [] } });
    expect(isStandaloneMobile()).toBe(true);
  });
});
