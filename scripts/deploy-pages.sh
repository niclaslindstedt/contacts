#!/usr/bin/env bash
# Publish a built site into one channel of the shared `gh-pages` branch.
#
# GitHub Pages serves a single site per repo, so the three release channels —
# the released app at the root, the rolling `main` build under `preview/`, and
# per-branch builds under `branch/<name>/` — have to coexist as sibling subtrees
# of one branch. `actions/deploy-pages` replaces the *whole* site on every run,
# which would clobber the other channels, so instead each deploy commits only
# its own subtree here and leaves the siblings untouched.
#
# Usage: deploy-pages.sh <dest> <src>
#   <dest>  "." for the root release, otherwise a channel subdir such as
#           "preview" or "branch/my-feature".
#   <src>   the built output directory to publish (e.g. dist).
#
# Requires GITHUB_TOKEN (contents: write), GITHUB_REPOSITORY, and — for the
# commit message — GITHUB_SHA, all provided by the Actions runner.
set -euo pipefail

DEST="${1:?usage: deploy-pages.sh <dest> <src>}"
SRC="${2:?usage: deploy-pages.sh <dest> <src>}"

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

SRC="$(cd "$SRC" && pwd)"
REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
WORKTREE="$(mktemp -d)"

git config --global user.name "release-bot"
git config --global user.email "release-bot@users.noreply.github.com"

# Fetch the existing branch, or start an orphan on first deploy.
if git ls-remote --exit-code --heads "$REMOTE" gh-pages >/dev/null 2>&1; then
  git clone --depth 1 --branch gh-pages "$REMOTE" "$WORKTREE"
else
  git clone --depth 1 "$REMOTE" "$WORKTREE"
  git -C "$WORKTREE" checkout --orphan gh-pages
  git -C "$WORKTREE" rm -rf . >/dev/null 2>&1 || true
fi

publish() {
  if [ "$DEST" = "." ]; then
    # Root release: replace the root-level files but preserve the sibling
    # channels (and .git), plus the custom-domain CNAME, so preview/ and branch/
    # and the domain binding all survive a release. (The release build also
    # ships its own CNAME from public/, so this is belt-and-suspenders.)
    find "$WORKTREE" -mindepth 1 -maxdepth 1 \
      ! -name .git ! -name preview ! -name branch ! -name CNAME \
      -exec rm -rf {} +
    cp -a "$SRC"/. "$WORKTREE"/
  else
    # Channel deploy: replace just this channel's subtree.
    rm -rf "${WORKTREE:?}/${DEST}"
    mkdir -p "$WORKTREE/$DEST"
    cp -a "$SRC"/. "$WORKTREE/$DEST"/
  fi
  # Serve the built output verbatim — never run it through Jekyll.
  touch "$WORKTREE/.nojekyll"
}

publish

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "No changes to deploy for '${DEST}'."
  exit 0
fi
git -C "$WORKTREE" commit -m "deploy(${DEST}): ${GITHUB_SHA:-local}"

# Serialise-friendly push: another channel may have landed on gh-pages while we
# built, so on rejection re-fetch, re-apply our subtree, and retry.
for attempt in 1 2 3 4 5; do
  if git -C "$WORKTREE" push "$REMOTE" HEAD:gh-pages; then
    exit 0
  fi
  echo "Push rejected (attempt ${attempt}); rebasing on latest gh-pages…"
  git -C "$WORKTREE" fetch "$REMOTE" gh-pages
  git -C "$WORKTREE" reset --hard FETCH_HEAD
  publish
  git -C "$WORKTREE" add -A
  git -C "$WORKTREE" diff --cached --quiet && exit 0
  git -C "$WORKTREE" commit -m "deploy(${DEST}): ${GITHUB_SHA:-local}"
done

echo "Failed to push to gh-pages after multiple attempts." >&2
exit 1
