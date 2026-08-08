// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render } from "preact";

// The default UI family (JetBrains Mono) is imported statically so it ships in
// the main bundle and precaches for offline first paint. The other font
// families load on demand when selected (the theme engine calls
// `loadFontFamily` — see the theme README's Fonts section).
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-ext-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-ext-700.css";

import "./styles.css";
import { LanguageRoot } from "./app/i18n/index.ts";

// In dev no worker registers (`usePwaUpdate` runs disabled), but a worker
// installed by a previous `vite preview` on this origin would keep serving
// stale bytes — unregister any so the dev server always wins. The production
// registration is owned by the framework's `usePwaUpdate` (workbox-window)
// in `App.tsx`, against the worker `pwa-plugin.ts` emits.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => void reg.unregister()));
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

// Trivial path-based switch. The build emits `dist/privacy/index.html` and
// `dist/home/index.html` (see the `emitPrivacyAlias` / `emitShowcaseAlias`
// plugins in `vite.config.ts`) so GitHub Pages serves the same SPA at
// `/privacy/` and `/home/`, and these checks decide which view to mount.
// Deploy slots nest the page one segment deeper (`/preview/privacy/`,
// `/preview/home/`); the suffix checks match both.
const path = window.location.pathname.replace(/\/$/, "");
const isPrivacy = path.endsWith("/privacy");
const isHome = path.endsWith("/home");

// Preact's own `render` mounts straight into the container — there is no
// root object to create. `StrictMode` is gone with it: Preact has no
// double-invoking dev mode, so `preact/compat` only aliases it to a plain
// `Fragment` and wrapping the tree in it would imply a check that never runs.
function loadPage() {
  if (isHome) {
    return import("./app/ShowcasePage.tsx").then((m) => m.ShowcasePage);
  }
  if (isPrivacy) {
    return import("./app/PrivacyPage.tsx").then((m) => m.PrivacyPage);
  }
  return import("./App.tsx").then((m) => m.App);
}

void loadPage().then((Page) => {
  render(
    <LanguageRoot>
      <Page />
    </LanguageRoot>,
    root,
  );
});
