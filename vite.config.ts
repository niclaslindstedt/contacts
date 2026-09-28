// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

import { appPwa } from "./pwa-plugin.ts";
import { withoutSourceLinks } from "./src/app/withoutSourceLinks.ts";

// The production origin — the alias pages point their Open Graph URLs here
// regardless of which deploy slot built them.
const SITE_URL = "https://contacts.niclaslindstedt.se";

// Per-route <head> overrides for the two standalone pages (`/privacy`,
// `/home`) the SPA mounts by pathname (see `src/main.tsx`). The homepage's
// head lives statically in `index.html`; these two carry their own title,
// description, and social-card copy, spliced into a copy of the
// built shell by the alias plugins below. `path` is the trailing-slash clean
// URL GitHub Pages serves the alias from.
type RouteHead = {
  path: string;
  title: string;
  description: string;
  ogType: "website" | "article";
};

const PRIVACY_ROUTE: RouteHead = {
  path: "/privacy/",
  title: "Privacy — Contacts",
  description:
    "Contacts privacy: local-first by default — no account, no cookies, no " +
    "analytics, no tracking. Optional Dropbox sync only when " +
    "you connect it.",
  ogType: "article",
};

const SHOWCASE_ROUTE: RouteHead = {
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
// icons, the noindex robots meta); this only swaps the title / description /
// OG / Twitter copy so each alias reads as its own page. Throws loudly if any
// expected tag is missing rather than silently shipping a page that inherits
// the homepage's title — a signal that `index.html`'s head was restructured
// and this splice needs to follow.
function spliceRouteHead(html: string, route: RouteHead): string {
  const pageUrl = `${SITE_URL}${route.path}`;
  const title = escapeHtml(route.title);
  const desc = escapeHtml(route.description);

  const sub = (re: RegExp, replacement: string, label: string): void => {
    if (!re.test(html)) {
      throw new Error(
        `route-alias: could not splice ${label} for ${route.path} — did ` +
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
  // The phone and desktop builds carry no og:url (`withoutWebsiteHead`).
  if (!appBuild) {
    sub(
      /(<meta property="og:url" content=")[^"]*("\s*\/>)/,
      `$1${pageUrl}$2`,
      "og:url",
    );
  }
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
function emitRouteAlias(route: RouteHead, dir: string): Plugin {
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
          source: spliceRouteHead(String(index.source), route),
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

// A build for an app that carries its files inside it: the DESKTOP SHELL
// (tauri/) and the PHONE WRAPPER (native/), set by each one's
// `scripts/bundle-web.mjs`.
//
// It changes exactly one thing, and it is about the medium rather than the
// audience: the service worker is left out (`serviceWorker: false` below —
// everything else `appPwa` writes into the `<head>` still applies). An app
// build has no deployment to discover an update from — a new version arrives
// as a new binary — so a worker here would precache a copy of files already on
// local disk and then serve the page from ITS copy. `__SHELL_BUILD__` carries
// the same fact into the app, where it switches off the update prompt that has
// nothing left to prompt about — and, with `__NATIVE_BUILD__` below, leaves out
// the Donate row and the achievements, which only the website carries.
const shellBuild = process.env.VITE_SHELL_BUILD === "on";

// A build for the PHONE WRAPPER (native/), set by `native/scripts/bundle-web.mjs`.
//
// It is about the channel rather than the medium: what only the website
// carries is left out — the side menu's Donate row (`src/app/donate.ts`) and
// the achievements (`src/app/achievementsBuilt.ts`). With `__SHELL_BUILD__` it
// marks every build that is not the website — a payment link outside Apple's
// is an App Store rejection (guideline 3.1.1), the listings promise nothing is
// sold, and no Nird app ships achievements outside the website. Both are
// compile-time constants, so those parts are folded out of the bundles rather
// than hidden.
const nativeBuild = process.env.VITE_NATIVE_BUILD === "on";

// Every build that is not the website: the phone app and the desktop app.
// Neither carries a link back to the source or the website's domain (the
// owner's decision D17, `src/app/sourceLinks.ts`) — not in the app, and not in
// what this config writes around it either.
const appBuild = nativeBuild || shellBuild;

// The website's own `<head>` and files, left out of an app build: the social
// card tags that point at the website's domain (og:url, og:image,
// twitter:image — an app has no page to share), the `/home/` alias (the page
// behind it is the website's alone, see `src/main.tsx`), and `public/CNAME`,
// which names the domain for GitHub Pages. The markdown What's new renders —
// the CHANGELOG and the feature docs, each a `.md?raw` module — is loaded
// without its source links (`src/app/withoutSourceLinks.ts`).
// `scripts/website-only.mjs` refuses an app webroot that still carries the
// domain.
function withoutWebsiteHead(): Plugin {
  let outDir = "dist";
  return {
    name: "without-website-head",
    apply: "build",
    enforce: "pre",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    load(id) {
      const [file, query] = id.split("?");
      if (query !== "raw" || !file!.endsWith(".md")) return null;
      const md = withoutSourceLinks(readFileSync(file!, "utf8"));
      return `export default ${JSON.stringify(md)};`;
    },
    transformIndexHtml(html) {
      return html.replace(/\s*<meta\b[^>]*niclaslindstedt[^>]*>/g, "");
    },
    closeBundle() {
      rmSync(resolve(outDir, "CNAME"), { force: true });
    },
  };
}

export default defineConfig({
  base,
  build: {
    // No size budgets, by owner decision — high enough that Vite never warns.
    chunkSizeWarningLimit: 100_000,
    modulePreload: {
      // Vite wraps every `import()` in a preload helper carrying that call's
      // dependency list, and the minifier folds the three route branches in
      // `main.tsx` back into one call however the source is written — so that
      // helper ends up preloading the UNION of all three, and `/privacy/`
      // eagerly fetches the whole app. Dropping the JS-side dependency hints
      // lets each branch pull only what it actually imports; the entry's own
      // `<link rel="modulepreload">` tags in the HTML are kept.
      resolveDependencies: (_url, deps, { hostType }) =>
        hostType === "js" ? [] : deps,
    },
  },
  define: {
    __SHELL_BUILD__: JSON.stringify(shellBuild),
    __NATIVE_BUILD__: JSON.stringify(nativeBuild),
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_LABEL__: JSON.stringify(buildLabel),
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  // `appPwa` only applies on build, so dev keeps registering no worker (the
  // app passes `enabled: !import.meta.env.DEV` to `usePwaUpdate`).
  //
  // The runtime is Preact, not React: `@preact/preset-vite` compiles JSX
  // against `preact/jsx-runtime` and aliases `react` / `react-dom` (and the
  // `/jsx-runtime` + `/client` subpaths) onto `preact/compat`, so both this
  // app's `import … from "react"` lines and the pre-built framework chunks —
  // which import `react`, `react-dom`, and `react/jsx-runtime` as externals —
  // resolve to Preact. Nothing from React itself reaches the bundle; see
  // `docs/architecture.md`.
  plugins: [
    preact(),
    tailwindcss(),
    appPwa({ base, version, ignorePaths, serviceWorker: !shellBuild }),
    ...(appBuild
      ? [withoutWebsiteHead()]
      : [emitRouteAlias(SHOWCASE_ROUTE, "home")]),
    emitRouteAlias(PRIVACY_ROUTE, "privacy"),
  ],
});
