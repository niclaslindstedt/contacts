// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Refuses an app webroot that carries what only the website may:
//
//   - a service worker (`sw.js`) — an app's files ship inside it and a new
//     version arrives as a new binary, so a worker would only serve a staler
//     copy of them and prompt for updates nobody can apply;
//   - a Donate link (App Store guideline 3.1.1; `src/app/donate.ts`);
//   - the achievements (`src/app/achievementsBuilt.ts`);
//   - a link back to the source, or any other mention of the owner's name —
//     the repository, its issues, releases or sponsor page, the website's
//     domain (the owner's decision; `src/app/sourceLinks.ts`).
//
// The worker is left out by `VITE_SHELL_BUILD=on`, which both app builds set;
// the rest is compiled out of the phone build (`VITE_NATIVE_BUILD=on`) and the
// desktop build (`VITE_SHELL_BUILD=on`) alike. A `dist/` left by a website build
// carries them, and so would a webroot copied or zipped from it. This is the
// check that the build honoured the flags — the failure is otherwise
// invisible until review.
//
// Every file is searched, whatever its type — a banner in a font, a comment in
// a source map, `CNAME` — because the rule is about the bundle, not its code.
//
// Used by `native/scripts/bundle-web.mjs` (over the files it zips) and
// `tauri/scripts/bundle-web.mjs` (over the webroot it copies); runnable on its
// own too:
//   node scripts/website-only.mjs tauri/webroot

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function needles() {
  return [
    ["a Donate link", "github.com/sponsors"],
    ["a Donate link", process.env.VITE_DONATE_URL?.trim()],
    ["the achievements", "contacts:achievements"],
    // The achievements feature page (docs/features/achievements.md), which the
    // What's new dialog would otherwise open.
    ["the achievements page", "also a **trophy** to unlock"],
    ["the achievements page", "opens the achievements tour"],
    // github.com/niclaslindstedt/…, github.com/sponsors/niclaslindstedt,
    // contacts.niclaslindstedt.se, @niclaslindstedt/oss-framework.
    ["a link back to the source", "niclaslindstedt"],
  ].filter(([, needle]) => needle);
}

/** Every file under `dir`, as `{ "path/from/dir": bytes }`. */
export function readTree(dir, root = dir, files = {}) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) readTree(path, root, files);
    else files[relative(root, path).split("\\").join("/")] = readFileSync(path);
  }
  return files;
}

/** Throws when any file in `files` (`{ path: bytes }`) carries a
 *  website-only needle. `hint` says how to build it properly. */
export function assertWebsiteOnlyAbsent(files, hint) {
  const list = needles();
  for (const [path, bytes] of Object.entries(files)) {
    if (/^sw\.m?js$/.test(path)) {
      throw new Error(
        `${path} is a service worker — only the website may carry one. ${hint}`,
      );
    }
    const buf = Buffer.from(bytes);
    const hit = list.find(([, needle]) => buf.includes(needle));
    if (hit) {
      throw new Error(
        `${path} carries ${hit[0]} (${hit[1]}) — only the website may. ${hint}`,
      );
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: node scripts/website-only.mjs <webroot dir>");
    process.exit(2);
  }
  try {
    assertWebsiteOnlyAbsent(
      readTree(dir),
      "Build it through native/ or tauri/ scripts/bundle-web.mjs.",
    );
    console.log(
      `✓ ${dir}: no service worker, no Donate link, no achievements, no link to the source`,
    );
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
