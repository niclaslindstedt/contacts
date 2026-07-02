#!/usr/bin/env node
// Clone a mirrored repository into a throwaway temp directory for read-only
// inspection. The git URL is built from $MIRROR_BASE + the repo name and
// authenticated with $MIRROR_TOKEN, which is read by git's credential-helper
// subshell at run time so it never lands in argv, the URL, or .git/config.
//
// Usage:
//   node clone.mjs <repo> [--shallow] [--depth N] [--dest DIR]
//
// Prints the clone directory as the final stdout line, so callers can capture
// it: DEST="$(node clone.mjs notes)".
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fail(message) {
  console.error(`clone-mirror-repo: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
let repo;
let shallow = false;
let depth = 1;
let dest;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--shallow") {
    shallow = true;
  } else if (arg === "--depth") {
    depth = Number(args[++i]);
    shallow = true;
    if (!Number.isInteger(depth) || depth < 1) {
      fail("--depth requires a positive integer");
    }
  } else if (arg === "--dest") {
    dest = args[++i];
    if (!dest) fail("--dest requires a directory");
  } else if (arg === "--help" || arg === "-h") {
    console.log(
      "Usage: node clone.mjs <repo> [--shallow] [--depth N] [--dest DIR]",
    );
    process.exit(0);
  } else if (arg.startsWith("-")) {
    fail(`unknown flag: ${arg}`);
  } else if (!repo) {
    repo = arg;
  } else {
    fail(`unexpected argument: ${arg}`);
  }
}

if (!repo) fail("missing repo name (e.g. `notes`)");

const base = process.env.MIRROR_BASE;
if (!base) fail("MIRROR_BASE is not set");
if (!process.env.MIRROR_TOKEN) fail("MIRROR_TOKEN is not set");

const url = `https://${base.replace(/\/+$/, "")}/${repo}.git`;
const target = dest ?? mkdtempSync(join(tmpdir(), `mirror-${repo}-`));

// `-c credential.helper=` first clears any inherited helper; the second `-c`
// installs a one-shot helper that emits the token from the environment.
const helper =
  '!f() { echo "username=oauth2"; echo "password=${MIRROR_TOKEN}"; }; f';

const gitArgs = [
  "-c",
  "credential.helper=",
  "-c",
  `credential.helper=${helper}`,
  "clone",
];
if (shallow) gitArgs.push("--depth", String(depth), "--no-single-branch");
gitArgs.push(url, target);

const result = spawnSync("git", gitArgs, {
  stdio: "inherit",
  env: process.env,
});
if (result.status !== 0) {
  fail(`git clone failed (${result.status ?? `signal ${result.signal}`})`);
}

// Final stdout line is the bare path, for `$(...)` capture.
console.log(target);
