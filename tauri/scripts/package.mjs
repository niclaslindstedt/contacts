// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Packages the desktop app: bundles the site (scripts/bundle-web.mjs), then
// runs `tauri build` with the deployment's identity merged over the committed
// config.
//
// The committed `src-tauri/tauri.conf.json` carries the project's own name and
// a development identifier. What a store or a download is called, and the
// identifier it installs under, are facts about a deployment rather than about
// the code, so they arrive the way they do for the phone app: as
// APP_DISPLAY_NAME and APP_BUNDLE_ID, the same two variables under the same
// names in every app. Unset, a checkout packages under the development
// identity and runs.
//
// THE IDENTIFIER IS ALSO WHERE THE DATA LIVES. Each desktop webview keys its
// storage directory by it, so an installed copy's contacts belong to the
// identifier it shipped under. Changing it after a release strands them.
//
// Usage:
//   node scripts/package.mjs                     # bundle, then `tauri build`
//   node scripts/package.mjs --debug             # …debug profile
//   node scripts/package.mjs --require-identity  # a release: refuse the dev identity
// Anything else is forwarded to `tauri build` (e.g. `--target <triple>`).

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WINDOWS = process.platform === "win32";

const args = process.argv.slice(2);
const requireIdentity = args.includes("--require-identity");
const forwarded = args.filter((arg) => arg !== "--require-identity");

const displayName = process.env.APP_DISPLAY_NAME?.trim() ?? "";
const bundleId = process.env.APP_BUNDLE_ID?.trim() ?? "";

if (requireIdentity) {
  const missing = [
    ["APP_DISPLAY_NAME", displayName],
    ["APP_BUNDLE_ID", bundleId],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    console.error(
      `✗ ${missing.join(" and ")} not set. A release package needs the ` +
        `deployment's identity rather than the development one — set them as ` +
        `repository secrets. See tauri/README.md.`,
    );
    process.exit(1);
  }
}

execFileSync(process.execPath, [join(APP_DIR, "scripts", "bundle-web.mjs")], {
  cwd: APP_DIR,
  stdio: "inherit",
});

const override = {
  ...(displayName ? { productName: displayName } : {}),
  ...(bundleId ? { identifier: bundleId } : {}),
};
const configArgs = [];
if (Object.keys(override).length > 0) {
  const file = join(mkdtempSync(join(tmpdir(), "tauri-identity-")), "id.json");
  writeFileSync(file, JSON.stringify(override));
  configArgs.push("--config", file);
  console.log(
    `• packaging as ${displayName || "(project name)"} — ` +
      `${bundleId || "(development identifier)"}`,
  );
} else {
  console.log("• packaging under the development identity");
}

// THE MAC APP IS NEVER UNSIGNED. Apple Silicon refuses to execute unsigned
// arm64 code and tells the user "the app is damaged", the same wording it uses
// for a corrupted download. An ad-hoc signature ("-") satisfies the kernel and
// is what a developer build and a CI run with no certificate get; a Developer
// ID identity (APPLE_SIGNING_IDENTITY, exported by
// .github/actions/apple-signing once it has imported the certificate) is the
// real thing, with notarization on top. `tauri build` reads the variable ahead
// of the config, so an EMPTY one is replaced here rather than handed on as an
// identity called "".
const env = { ...process.env };
if (process.platform === "darwin" && !env.APPLE_SIGNING_IDENTITY?.trim()) {
  env.APPLE_SIGNING_IDENTITY = "-";
  console.log("• macOS: no signing identity — signing ad hoc");
}

execFileSync(
  WINDOWS ? "npx.cmd" : "npx",
  ["tauri", "build", ...configArgs, ...forwarded],
  { cwd: APP_DIR, env, stdio: "inherit", shell: WINDOWS },
);
