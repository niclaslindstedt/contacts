// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { appPwa } from "./pwa-plugin.ts";

// The canonical production origin — the alias pages point their canonical /
// Open Graph URLs here regardless of which deploy slot built them, since the
// `/` release is the one search engines should index.
const SITE_URL = "https://contacts.niclaslindstedt.se";

// Per-route <head> overrides for the two standalone pages (`/privacy`,
// `/home`) the SPA mounts by pathname (see `src/main.tsx`). The homepage's
// SEO lives statically in `index.html`; these two carry their own title,
// description, canonical, and social-card copy, spliced into a copy of the
// built shell by the alias plugins below. `path` is the trailing-slash clean
// URL GitHub Pages serves the alias from.
type RouteSeo = {
  path: string;
  title: string;
  description: string;
  ogType: "website" | "article";
};

const PRIVACY_ROUTE: RouteSeo = {
  path: "/privacy/",
  title: "Privacy — Contacts",
  description:
    "Contacts privacy: local-first by default — no account, no cookies, no " +
    "analytics, no tracking. Optional Dropbox / Google Drive sync only when " +
    "you connect it.",
  ogType: "article",
};

const SHOWCASE_ROUTE: RouteSeo = {
  path: "/home/",
  title: "Contacts — what it does & why it asks for access",
  description:
    "What Contacts does, where your data lives, and why it requests Google " +
    "Drive or Dropbox access — only when you turn on optional cloud sync.",
  ogType: "website",
};

// HTML-escape a string destined for an attribute value or text node.
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Rewrite the per-route <head> signals in a copy of the built `index.html`.
// The homepage shell is the single source of the tag *shape* (asset links,
// icons, JSON-LD); this only swaps the title / description / canonical / OG /
// Twitter copy so each alias reads as its own page. Throws loudly if any
// expected tag is missing rather than silently shipping a page that inherits
// the homepage's title — a signal that `index.html`'s head was restructured
// and this splice needs to follow.
function spliceRouteSeo(html: string, route: RouteSeo): string {
  const canonical = `${SITE_URL}${route.path}`;
  const title = escapeHtml(route.title);
  const desc = escapeHtml(route.description);

  const sub = (re: RegExp, replacement: string, label: string): void => {
    if (!re.test(html)) {
      throw new Error(
        `seo-alias: could not splice ${label} for ${route.path} — did ` +
          `index.html's <head> change shape?`,
      );
    }
    html = html.replace(re, replacement);
  };

  sub(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, "title");
  sub(
    /(<meta\s+name="description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${desc}$2`,
    "description",
  );
  sub(
    /(<link rel="canonical" href=")[^"]*("\s*\/>)/,
    `$1${canonical}$2`,
    "canonical",
  );
  sub(
    /(<meta property="og:type" content=")[^"]*("\s*\/>)/,
    `$1${route.ogType}$2`,
    "og:type",
  );
  sub(
    /(<meta property="og:title" content=")[\s\S]*?("\s*\/>)/,
    `$1${title}$2`,
    "og:title",
  );
  sub(
    /(<meta\s+property="og:description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${desc}$2`,
    "og:description",
  );
  sub(
    /(<meta property="og:url" content=")[^"]*("\s*\/>)/,
    `$1${canonical}$2`,
    "og:url",
  );
  sub(
    /(<meta\s+name="twitter:title"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${title}$2`,
    "twitter:title",
  );
  sub(
    /(<meta\s+name="twitter:description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${desc}$2`,
    "twitter:description",
  );
  return html;
}

// Mirror the built `index.html` to `<route>/index.html` so GitHub Pages serves
// the SPA from the clean URL `/privacy/` or `/home/` (and `/preview/privacy/`,
// …). `src/main.tsx` reads `location.pathname` and mounts the matching page;
// the copied HTML loads the same origin-absolute hashed asset URLs, so no
// rewrite is needed — only the per-route <head> copy is re-spliced. Runs late
// (`enforce: "post"`) so the PWA plugin's manifest / icon tags are already
// baked into the shell we copy, and after `appPwa` so the alias pages stay out
// of its precache (the service worker's shell fallback already covers them).
function emitRouteAlias(route: RouteSeo, dir: string): Plugin {
  return {
    name: `emit-${dir}-alias`,
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index && index.type === "asset") {
        this.emitFile({
          type: "asset",
          fileName: `${dir}/index.html`,
          source: spliceRouteSeo(String(index.source), route),
        });
      }
    },
  };
}

// The base path is injected by the deploy workflows via VITE_BASE, one per
// release channel on the custom domain (contacts.niclaslindstedt.se): the
// released app at `/`, the rolling main build at `/preview/`, and per-branch
// builds at `/branch/<name>/`. Defaults to `/` for local dev and preview builds.
const base = process.env.VITE_BASE ?? "/";

// Sibling release channels that live *under* this build's base and must be
// disowned by its service worker (see pwa-plugin.ts `ignorePaths`). Only the
// root release sets this — comma-separated absolute paths, e.g.
// `/preview/,/branch/`.
const ignorePaths = (process.env.VITE_PWA_IGNORE_PATHS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

// Build identity for the Developer tab's "Build" grid.
const commit =
  process.env.GITHUB_SHA?.slice(0, 7) ??
  (() => {
    try {
      return execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return "unknown";
    }
  })();
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? "dev";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The app's released version, the base of the About dropdown's build label.
const appVersion = (
  JSON.parse(readFileSync(here("./package.json"), "utf8")) as {
    version: string;
  }
).version;

// The build identifier shown in the side menu's About dropdown. Shape:
// `<version>[.<run>][-<slot>][+<commit>]` — `<run>` is the CI run number,
// `<slot>` is `pre` for the `/preview/` deploy and `br` for `/branch/`
// (omitted for the production `/` build), and `<commit>` is the short
// commit hash as semver build metadata. A local build collapses to just
// `<version>`. Mirrors the checklist reference app's BUILD_LABEL.
const buildSlot =
  base === "/preview/" ? "pre" : base === "/branch/" ? "br" : "";
const buildLabel =
  appVersion +
  (process.env.GITHUB_RUN_NUMBER ? `.${process.env.GITHUB_RUN_NUMBER}` : "") +
  (buildSlot ? `-${buildSlot}` : "") +
  (process.env.GITHUB_SHA ? `+${process.env.GITHUB_SHA.slice(0, 7)}` : "");

// The label the PWA update toast shows for the incoming build — the full
// build identifier (`buildLabel`, e.g. `1.3.0.237-pre+4f23a97`) so the prompt
// names the same version as the About dropdown rather than a bare commit sha.
// It also lands in the generated `sw.js`, so the worker's bytes change every
// deploy and the browser reliably discovers the update; a CI build's label
// carries the run number and commit, so it is unique per deploy. A local
// build's label collapses to just `<version>`, so append a timestamp there to
// keep the per-build uniqueness the worker relies on.
const version = process.env.GITHUB_SHA
  ? buildLabel
  : `${buildLabel}+${new Date().toISOString()}`;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_LABEL__: JSON.stringify(buildLabel),
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  // `appPwa` only applies on build, so dev keeps registering no worker (the
  // app passes `enabled: !import.meta.env.DEV` to `usePwaUpdate`).
  plugins: [
    react(),
    tailwindcss(),
    appPwa({ base, version, ignorePaths }),
    emitRouteAlias(SHOWCASE_ROUTE, "home"),
    emitRouteAlias(PRIVACY_ROUTE, "privacy"),
  ],
});
