#!/bin/bash
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
#
# SessionStart hook for Claude Code on the web. Installs the npm dependencies in
# the background so `make lint` / `make test` / `make build` work the moment a
# web session opens — no waiting for a manual `npm install` first.
#
# `@niclaslindstedt/oss-framework` resolves from the GitHub Packages registry,
# which requires an auth token even for public reads (see AGENTS.md). Web
# sessions expose a GitHub token in the environment; we write it into the user
# `~/.npmrc` so npm can authenticate, and leave the committed project `.npmrc`
# token-free. Nothing secret is written into the repo.
set -euo pipefail

# Announce async mode: this line must be the first thing on stdout. The install
# then runs in the background while the session starts.
echo '{"async": true, "asyncTimeout": 600000}'

# Only the remote (web) environment needs this. Locally you manage `~/.npmrc`
# yourself, so bail out to avoid touching a developer's npm config.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"}"

# Resolve a GitHub Packages token from whichever variable the environment set.
# The list is ordered by specificity; the first non-empty one wins.
token=""
for var in NODE_AUTH_TOKEN GITHUB_PAT GH_TOKEN GITHUB_TOKEN; do
  if [ -n "${!var:-}" ]; then
    token="${!var}"
    break
  fi
done

if [ -n "$token" ]; then
  npmrc="${HOME}/.npmrc"
  # Drop any prior token line so a rotated token replaces it, keep the rest.
  if [ -f "$npmrc" ]; then
    grep -v '^//npm.pkg.github.com/:_authToken=' "$npmrc" >"${npmrc}.tmp" || true
    mv "${npmrc}.tmp" "$npmrc"
  fi
  printf '//npm.pkg.github.com/:_authToken=%s\n' "$token" >>"$npmrc"
else
  echo "session-start: no GitHub token in the environment — npm install may fail" \
       "to reach GitHub Packages (@niclaslindstedt/oss-framework)." >&2
fi

# Prefer `npm install` over `npm ci`: it reuses whatever is already in
# node_modules, so a re-run after the container cache warms is cheap, and it
# never wipes a partially-populated tree.
npm install --no-audit --no-fund

# The `design` maintenance skill drives a headless Chromium through Playwright
# to screenshot the app while iterating on UI. Playwright is deliberately NOT a
# project dependency — no build/test/lint step uses it, so human contributors
# and CI stay lean — but a web session already has the Chromium binary
# preinstalled (under PLAYWRIGHT_BROWSERS_PATH), so the only missing piece is the
# small, browserless `playwright-core` package. Install it here — `--no-save`, so
# package.json / the lockfile stay untouched — so an agent can run the skill
# without a manual `npm i` first. Non-fatal: only the design skill needs it, so a
# failure must not break session start.
npm install --no-save --no-audit --no-fund playwright-core@1 \
  || echo "session-start: playwright-core install failed — the design skill" \
          "won't run until it's installed; nothing else needs it." >&2
