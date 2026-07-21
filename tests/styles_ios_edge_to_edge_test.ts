import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The installed iOS PWA only paints under the home indicator when the *root*
// element carries a fixed `100vh` height; with the shell's `100svh` (or any
// percentage height) iOS letterboxes and leaves a dead black band at the
// bottom, so the app never reaches the physical bottom of the screen and the
// side-menu footer / collapse rail float above the gap. The fix lives in
// styles.css as a scoped override. These assertions lock in both the override
// and its scoping so a future edit can't silently reintroduce the band, and
// can't leak the `100vh` into a plain iOS Safari tab (where it would bring back
// the rubber-band bounce that `100svh` exists to avoid).
const css = readFileSync(
  fileURLToPath(new URL("../src/styles.css", import.meta.url)),
  "utf8",
);

describe("styles.css shell height", () => {
  it("keeps the default shell on a percentage/small viewport unit", () => {
    // The app shell and the framework drawer both fall back to `100svh`.
    expect(css).toMatch(/100svh/);
  });

  it("forces the root to 100vh only in the installed iOS PWA", () => {
    // Collapse whitespace so the assertion is insensitive to formatting.
    const flat = css.replace(/\s+/g, " ");
    // The override must be nested inside BOTH the iOS probe and the
    // standalone-display media query, and set html/body to 100vh plus lift the
    // shared --app-height variable so the shell and drawer fill the screen.
    expect(flat).toMatch(
      /@supports \(-webkit-touch-callout: none\) \{ @media \(display-mode: standalone\) \{ html, body \{ height: 100vh; \} :root \{ --app-height: 100vh; \} \} \}/,
    );
  });

  it("does not force 100vh outside the iOS-standalone guard", () => {
    // No bare `height: 100vh` should exist anywhere else — that would
    // rubber-band an iOS Safari tab. The only real `height` declaration set to
    // 100vh is the guarded html/body (the lookbehind excludes the
    // `--app-height` custom-property that also lifts to 100vh in the guard).
    const heightOccurrences = css.match(/(?<![-\w])height:\s*100vh/g) ?? [];
    expect(heightOccurrences).toHaveLength(1);
  });
});
