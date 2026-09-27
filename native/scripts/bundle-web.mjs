// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Builds the web app and packs its `dist/` into one asset —
// `native/assets/webroot.zip` — that the wrapper bundles, unpacks on first
// launch and serves over a loopback HTTP server (src/local-server.ts). That is
// what makes the app self-contained: the address book runs entirely
// on-device, and changes only when a new build ships to the store.
//
// The web build is `npm run build` at the repo root — base `/`, which is
// exactly what a localhost origin wants — with one flag, `VITE_NATIVE_BUILD=on`.
// It is about the channel rather than the medium: it compiles out what only
// the website carries — the side menu's Donate row (App Store guideline 3.1.1;
// see `src/app/donate.ts`) and the achievements (`src/app/achievementsGate.ts`).
// Nothing else in `src/` changes for the app. If the wrapper ever needs the
// web app to behave differently in some other way, that is a sign it has
// stopped being thin.
//
// The flag is build-time, so `--skip-build` re-zips whatever the last build
// left in `dist/` — and a website build there carries the Donate link and the
// achievements. The zip is refused when either is found in it
// (`assertWebsiteOnlyAbsent`).
//
// Usage:
//   node scripts/bundle-web.mjs                 # build the site, then zip it
//   node scripts/bundle-web.mjs --skip-build    # re-zip an existing dist/
//   node scripts/bundle-web.mjs --profile production
//
// `--profile` is accepted (and echoed) so the release scripts and the CI
// workflow can pass the EAS profile through uniformly. It does not change the
// build today — the web app has no profile-dependent output — but the seam is
// where a "strip the developer menu from store builds" knob would land, and
// having the plumbing already correct is cheaper than retrofitting it.
//
// The zip is a build artifact (gitignored). Generate it before `eas build`;
// the root `.easignore` is what keeps it in the EAS upload despite that.

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { zipSync } from "fflate";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_DIR = resolve(APP_DIR, "..");
const DIST_DIR = join(REPO_DIR, "dist");
const OUT_ZIP = join(APP_DIR, "assets", "webroot.zip");
const WINDOWS = process.platform === "win32";
const NPM = WINDOWS ? "npm.cmd" : "npm";

const skipBuild = process.argv.includes("--skip-build");
const profileArg = process.argv.indexOf("--profile");
const profile =
  (profileArg >= 0 ? process.argv[profileArg + 1] : undefined) ??
  process.env.EAS_BUILD_PROFILE ??
  "preview";

if (!skipBuild) {
  console.log(`• building the web app (npm run build) — profile ${profile}…`);
  execFileSync(NPM, ["run", "build"], {
    cwd: REPO_DIR,
    stdio: "inherit",
    // npm on Windows is a batch shim, which Node cannot execute directly.
    shell: WINDOWS,
    env: { ...process.env, VITE_NATIVE_BUILD: "on" },
  });
}

/** Collect `dist/` into the flat `{ "index.html": bytes }` shape fflate wants,
 *  with forward-slash paths relative to the dist root. */
function collect(dir, files = {}) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      collect(abs, files);
    } else {
      files[relative(DIST_DIR, abs).split("\\").join("/")] = new Uint8Array(
        readFileSync(abs),
      );
    }
  }
  return files;
}

let files;
try {
  files = collect(DIST_DIR);
} catch (error) {
  console.error(
    `\n✗ could not read ${DIST_DIR} — build the web app first ` +
      `(drop --skip-build, or run 'npm run build' at the repo root).\n`,
  );
  throw error;
}

const count = Object.keys(files).length;
if (count === 0 || !files["index.html"]) {
  throw new Error(
    `dist/ has no index.html (${count} files) — the web build looks empty.`,
  );
}

/** Refuse a webroot that carries what only the website may: a Donate link
 *  (App Store guideline 3.1.1) or the achievements. A `dist/` left by a
 *  website build — which `--skip-build` would re-zip — carries both. Looks for
 *  the GitHub Sponsors fallback, for whatever `VITE_DONATE_URL` this shell has
 *  set, for the achievements ledger's storage key, which only the
 *  achievements wiring (`src/app/useAchievements.ts`) spells, and for lines
 *  only the achievements feature page (`docs/features/achievements.md`) has. */
function assertWebsiteOnlyAbsent(files) {
  const needles = [
    ["a Donate link", "github.com/sponsors"],
    ["a Donate link", process.env.VITE_DONATE_URL?.trim()],
    ["the achievements", "contacts:achievements"],
    // The achievements feature page (docs/features/achievements.md), which the
    // What's new dialog would otherwise open.
    ["the achievements page", "also a **trophy** to unlock"],
    ["the achievements page", "opens the achievements tour"],
  ].filter(([, needle]) => needle);
  const decoder = new TextDecoder();
  for (const [path, bytes] of Object.entries(files)) {
    if (!/\.(html|js|mjs|css|json|webmanifest|txt|xml)$/.test(path)) continue;
    const text = decoder.decode(bytes);
    const hit = needles.find(([, needle]) => text.includes(needle));
    if (hit) {
      throw new Error(
        `dist/${path} carries ${hit[0]} (${hit[1]}) — the phone app must ` +
          `not. Rebuild through this script (drop --skip-build) so ` +
          `VITE_NATIVE_BUILD=on compiles it out.`,
      );
    }
  }
}

assertWebsiteOnlyAbsent(files);

// Deterministic zip: every entry pinned to the ZIP epoch (1980-01-01), so the
// artifact is reproducible instead of drifting with the clock.
const zipped = zipSync(files, { mtime: new Date("1980-01-01T00:00:00Z") });
mkdirSync(dirname(OUT_ZIP), { recursive: true });
writeFileSync(OUT_ZIP, zipped);

console.log(
  `✓ wrote ${OUT_ZIP} — ${count} files, ${(zipped.length / 1024).toFixed(0)} KB`,
);
