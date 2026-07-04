// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The default UI family (JetBrains Mono) is imported statically so it ships in
// the main bundle and precaches for offline first paint. The other font
// families load on demand when selected (the theme engine calls
// `loadFontFamily` — see the theme README's Fonts section).
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-ext-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-ext-700.css";

import "./styles.css";
import { App } from "./App.tsx";
import { PrivacyPage } from "./app/PrivacyPage.tsx";
import { ShowcasePage } from "./app/ShowcasePage.tsx";
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

createRoot(root).render(
  <StrictMode>
    <LanguageRoot>
      {isHome ? <ShowcasePage /> : isPrivacy ? <PrivacyPage /> : <App />}
    </LanguageRoot>
  </StrictMode>,
);
