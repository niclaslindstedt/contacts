---
name: clone-mirror-repo
description: "Use when the user asks to clone one of their mirrored repositories by name (e.g. \"clone the notes repo\") to inspect it. Builds the git URL from MIRROR_BASE + the repo name, authenticates with MIRROR_TOKEN, and clones into a temporary directory (deep by default, shallow on request)."
---

# Clone a mirrored repo for inspection

Clone a sibling repository from the user's mirror into a **throwaway temporary
directory** so you can read it and understand how it works. The purpose is
inspection — not to add the clone to this repo, and not to modify the sibling.
Nothing from the clone is ever committed or pushed.

Trigger phrases: "clone the notes repo", "clone `<name>` so I can see how it
does X", "grab the `<name>` repo from my mirror".

## Inputs (environment)

The mirror is configured entirely through environment variables. Never hardcode
their values — read them at run time.

| Variable      | Meaning                                                              | Example                          |
| ------------- | ------------------------------------------------------------------- | -------------------------------- |
| `MIRROR_BASE` | Host + path prefix of the mirror, no scheme, may end with a slash.   | `gitlab.com/niclaslindstedt/`    |
| `MIRROR_TOKEN`| Personal access token with read access to the mirror. **Secret.**   | *(never print or commit this)*   |

The repo name is whatever the user names ("notes", "dotfiles", …). The git URL
is `https://<MIRROR_BASE trimmed>/<repo>.git`.

## Security rules

- **Never** print, echo, log, or commit `MIRROR_TOKEN`, and never write it into
  a URL that lands in a `.git/config`, a command that gets echoed, or any file.
  The recipe below passes it through a git credential helper so it stays out of
  the clone's `.git/config` and out of the remote URL.
- The clone goes only into a `mktemp -d` directory. Do not clone into the
  working tree, and do not `git add` anything from it.
- If `MIRROR_BASE` or `MIRROR_TOKEN` is unset, stop and tell the user which one
  is missing rather than guessing.

## Recipe

```sh
# 1. Inputs — REPO comes from the user's request.
REPO="notes"                       # <-- the repo the user named
BASE="${MIRROR_BASE%/}"            # trim a trailing slash if present
SHALLOW=""                         # set to "--depth 1 --no-single-branch" for a shallow clone

# 2. Preconditions.
: "${MIRROR_BASE:?MIRROR_BASE is not set}"
: "${MIRROR_TOKEN:?MIRROR_TOKEN is not set}"

# 3. Build the URL (no credentials embedded) and a temp destination.
URL="https://${BASE}/${REPO}.git"
DEST="$(mktemp -d -t "mirror-${REPO}-XXXXXX")"

# 4. Clone. The token is supplied via a one-shot credential helper, so it never
#    touches the URL, the process's argv in a persisted config, or .git/config.
#    `-c credential.helper=` first clears any inherited helper.
git -c credential.helper= \
    -c 'credential.helper=!f() { echo "username=oauth2"; echo "password=${MIRROR_TOKEN}"; }; f' \
    clone ${SHALLOW} "$URL" "$DEST"

echo "Cloned ${REPO} into ${DEST}"
```

- **Deep clone (default):** leave `SHALLOW` empty — this fetches full history
  and all branches, which is what "clone" means unless the user says otherwise.
- **Shallow clone (on request):** when the user says "shallow clone", set
  `SHALLOW="--depth 1 --no-single-branch"`. Add `--depth N` instead of `1` if
  they ask for a specific depth. `--no-single-branch` keeps every branch tip so
  inspection isn't limited to the default branch.

The `oauth2` username is the GitLab convention for authenticating with a
personal access token over HTTPS; it works for any username the token accepts.
If the mirror host uses a different scheme (e.g. an `ssh://` remote), adjust the
URL accordingly — the credential-helper step only applies to HTTPS.

## After cloning

1. Confirm the clone succeeded and report the temp path to the user.
2. Explore it read-only (`ls`, `Read`, `Grep`, `git -C "$DEST" log`, …) to answer
   whatever the user wanted to understand.
3. When finished, the temp directory can be removed with `rm -rf "$DEST"`; it is
   outside the working tree and is never part of any commit.

## Verification

- The clone lives under a `mktemp -d` path, not in the working tree.
- `MIRROR_TOKEN` appears in no output, no file, and no `.git/config`
  (`git -C "$DEST" remote -v` should show the plain `https://…/<repo>.git` URL
  with no credentials in it).
- A deep clone has full history (`git -C "$DEST" log --oneline | wc -l` > 1 for a
  repo with history); a shallow clone reports `git -C "$DEST" rev-parse --is-shallow-repository`
  as `true`.
