// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { appPwa } from "./pwa-plugin.ts";

// The GitHub Pages base path is injected by the `pages.yml` workflow via
// VITE_BASE (a project site deploys under `/contacts/`). Defaults to `/` for
// local dev and preview builds.
const base = process.env.VITE_BASE ?? "/";

// The label the PWA update toast shows for the incoming build. Prefer the
// deploying commit (the workflow exposes GITHUB_SHA); fall back to a build
// timestamp for a local build. It also lands in the generated `sw.js`, so the
// worker's bytes change every deploy and the browser reliably discovers the
// update.
const version = process.env.GITHUB_SHA
  ? process.env.GITHUB_SHA.slice(0, 7)
  : new Date().toISOString();

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

// The app's released version, surfaced in the side menu's About dropdown.
const appVersion = (
  JSON.parse(readFileSync(here("./package.json"), "utf8")) as {
    version: string;
  }
).version;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  // `appPwa` only applies on build, so dev keeps registering no worker (the
  // app passes `enabled: !import.meta.env.DEV` to `usePwaUpdate`).
  plugins: [react(), tailwindcss(), appPwa({ base, version })],
});
