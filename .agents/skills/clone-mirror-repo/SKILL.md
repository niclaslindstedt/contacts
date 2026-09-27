---
name: clone-mirror-repo
description: 'Use when the user asks to clone one of their mirrored repositories by name (e.g. "clone the notes repo") to inspect it. Builds the git URL from MIRROR_BASE + the repo name, authenticates with MIRROR_TOKEN, and clones into a temporary directory (deep by default, shallow on request).'
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

| Variable       | Meaning                                                            | Example                        |
| -------------- | ------------------------------------------------------------------ | ------------------------------ |
| `MIRROR_BASE`  | Host + path prefix of the mirror, no scheme, may end with a slash. | `gitlab.com/niclaslindstedt/`  |
| `MIRROR_TOKEN` | Personal access token with read access to the mirror. **Secret.**  | _(never print or commit this)_ |

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

The skill ships a Node helper, [`clone.mjs`](clone.mjs), that does all of the
above. Run it with the repo the user named and capture the printed path:

```sh
# Deep clone (default) — full history, all branches.
DEST="$(node .claude/skills/clone-mirror-repo/clone.mjs notes)"

# Shallow clone — pass --shallow (or --depth N for a specific depth).
DEST="$(node .claude/skills/clone-mirror-repo/clone.mjs notes --shallow)"
```

The script prints the temporary clone directory as its final stdout line, so
`$(...)` captures exactly that path. Everything else — env-var validation, URL
construction, the `mktemp` directory, and the token-safe credential helper —
lives in the script.

### Flags

| Flag         | Effect                                                     |
| ------------ | ---------------------------------------------------------- |
| _(none)_     | Deep clone: full history and every branch. The default.    |
| `--shallow`  | Shallow clone at depth 1 (implies `--no-single-branch`).   |
| `--depth N`  | Shallow clone at depth `N` (also implies `--shallow`).     |
| `--dest DIR` | Clone into `DIR` instead of a fresh `mktemp -d` directory. |

### How it stays token-safe

`clone.mjs` invokes git with a one-shot credential helper
(`-c credential.helper=…`) that echoes the token from `$MIRROR_TOKEN` at run
time. The token therefore never appears in `argv`, in the clone URL, or in the
resulting `.git/config`. The `oauth2` username is the GitLab convention for
authenticating with a personal access token over HTTPS and works for any
username the token accepts. For a non-HTTPS mirror (e.g. an `ssh://` remote),
adjust the URL scheme — the credential-helper step only applies to HTTPS.

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
