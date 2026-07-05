# Agent guidance for contacts

This file is the canonical source of truth for AI coding agents working in this
repo. `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `GEMINI.md`, and
`.github/copilot-instructions.md` are symlinks to this file.

## OSS Spec conformance

This repository adheres to [`OSS_SPEC.md`](OSS_SPEC.md), a prescriptive
specification for open source project layout, documentation, automation, and
governance. A copy of the spec lives at the repository root so contributors and
AI agents can consult it without leaving the repo; its version is recorded in
the YAML front matter at the top of the file.

Run `oss-spec validate .` (or the standalone
[`validate.sh`](https://github.com/niclaslindstedt/oss-spec/blob/main/scripts/validate.sh))
to verify conformance. When in doubt about a layout, naming, or workflow
decision, consult the relevant section of `OSS_SPEC.md` — it is the source of
truth for the conventions this repo follows.

## Build and test commands

```sh
make install       # npm install (needs GitHub Packages auth — see below)
make build         # production build (vite build)
make test          # full test suite (vitest)
make lint          # eslint + tsc --noEmit
make fmt           # prettier --write
make fmt-check     # verify formatting (CI)
make icons         # regenerate the PWA icons + og image from the app mark
```

The `@niclaslindstedt/oss-framework` dependency comes from the **GitHub
Packages** npm registry (see `.npmrc`). GitHub Packages requires auth even for
public packages, so local installs need a `read:packages` token in `~/.npmrc`
(`//npm.pkg.github.com/:_authToken=<token>`); CI authenticates with the
workflow's `GITHUB_TOKEN`.

### Dependency install in web sessions

Claude Code on the web runs `.claude/hooks/session-start.sh` on `SessionStart`
(wired up in `.claude/settings.json`), so **dependencies install automatically
in the background** — an agent shouldn't run `make install` by hand first. The
hook resolves a GitHub Packages token from the environment
(`NODE_AUTH_TOKEN` / `GITHUB_PAT` / `GH_TOKEN` / `GITHUB_TOKEN`, first wins),
writes it to `~/.npmrc`, and runs `npm install` — the committed project
`.npmrc` stays token-free. It runs in **async** mode, so `node_modules` may
still be populating for a moment after the session opens; if a `make` target
fails on a missing dependency, wait and retry, or run `make install` once the
token is in place. The hook is a no-op outside the web environment
(`CLAUDE_CODE_REMOTE`), so it never touches a local developer's npm config.

### Fake data / seeded dev server

`npm run dev` **starts seeded by default** (`VITE_SEED=large`): the dev server
comes up on a throwaway sample address book full of varied edge-case contacts
(nameless/company-only cards, very long and unicode/RTL text, many phones and
emails, leap-day birthdays, every phone/postal style, archived cards, empty and
archived folders) instead of an empty document — so the UI, search, sort,
export, and formatters always have realistic input to shake out edge cases.

- The seed is a **storage backend that takes over storage, in memory** —
  `createSeedBackend` (`src/app/dev/seedBackend.ts`) replaces the real
  `localDocBackend` in the store; nothing is ever written to localStorage, and a
  page reload (or `npm run dev:clean`) drops back to the real address book. This
  mirrors the checklist project's dev-seed `StorageAdapter` swap.
- `VITE_SEED` controls it: `1`/`sample` (curated edge-case set), a number
  (roughly that many contacts), `large` (a big stress spread), `0`/unset (off).
  Override the default with e.g. `VITE_SEED=25 npm run dev`.
- The **Developer → Fake data** settings toggle (`useDevSeed`) flips the same
  backend live, without a rebuild. The sample builder is `buildFakeData`
  (`src/app/dev/fakeData.ts`). See `docs/configuration.md`.

## Commit and PR conventions

- All commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- PRs are squash-merged; the **PR title** becomes the single commit on `main`,
  so it must follow conventional-commit format.
- Breaking changes use `<type>!:` or a `BREAKING CHANGE:` footer.

### Watching a PR after you open it

Don't babysit a PR with polling. **Do not** schedule `send_later`, cron jobs,
`ScheduleWakeup`, or timed self-check-ins to re-check CI or merge state — those
just burn turns. Open the PR, confirm the checks you can see are green, then
stop. CI failures and review comments are delivered to the session as webhook
events, so you'll be woken when there's actually something to act on. React to
those events when they arrive; otherwise consider the PR handed off.

## Architecture summary

This is a **frontend-only, local-first PWA** — there is no server. It is an
adoption of the [`oss-framework`](https://github.com/niclaslindstedt/oss-framework)
reference app (see its `demo/ADOPTION.md` seam manifest), rescoped from
checklists to contacts.

The framework owns the UI kit and the generic mechanics: the `Sidebar` shell,
modals, theme engine, glyph catalogue, search matcher, storage adapters
(localStorage / Dropbox / Google Drive), the AES-GCM encryption wrapper, the
achievements engine, i18n runtime, logging, and the PWA update state machine.

The app owns the domain and the stores ("store stays in the app"):

- `src/app/types.ts` — the `Contact` / `Folder` / `AppData` model.
- `src/app/useContactStore.ts` — the per-namespace document store
  (localStorage-persisted JSON, undo/redo, all edit actions).
- `src/app/useSyncEngine.ts` — the real sync engine over the framework's
  storage adapters (debounced push, conflict/auth/throttle handling, optional
  `withEncryption` of the cloud copy).
- `src/app/export.ts` — pure renderers to vCard 3.0 / Outlook CSV / JSON.
- `src/app/ContactScreen.tsx`, `SideMenuContent.tsx`, `ArchiveScreen.tsx`,
  `SearchOverlay.tsx`, `SettingsModal.tsx` + `settings/` — the screens.
- `src/output.ts` — the §19.4 central output module (semantic log helpers over
  the in-app log store).
- `pwa-plugin.ts` — emits the service worker + version/precache manifests the
  framework's `usePwaUpdate` consumes.

Dependency direction: screens → stores → framework. Nothing imports from the
framework's internals — only its published subpaths.

### Reach for the framework first

Before building any UI primitive, gesture, or generic mechanic, **check whether
`@niclaslindstedt/oss-framework` already ships it** — the framework owns the
UI kit and the reusable mechanics, and the app should consume them rather than
reinvent them. Its published surface is broad: components (`Button`, `ToggleRow`,
`SegmentedControl`, `SelectPicker`, `Section`, `Modal`, `ConfirmDialog`,
`SwipeableRow`, `FloatingPanel`, the icon set including `GripIcon` / `HeartIcon`,
…), hooks (e.g. `useDragDrop` for touch-friendly drag-and-drop and reordering),
plus the storage, encryption, glyphs, achievements, and PWA subpaths. Inspect
what's available under `node_modules/@niclaslindstedt/oss-framework/dist/**` (the
`.d.ts` files list every export) and prefer an existing primitive over a
hand-rolled one; only build app-local UI when the framework genuinely has no fit.

### Keep the framework current

**Before starting a task, update the framework to its latest published version.**
Check the newest release with `npm view @niclaslindstedt/oss-framework version`,
bump the `package.json` range if a newer one exists, reinstall, and work against
that — so you're always building on the latest components and fixes rather than a
stale copy.

## Where new code goes

| Change type | Goes in                                                               |
| ----------- | --------------------------------------------------------------------- |
| New feature | `src/app/...`                                                         |
| Tests       | `tests/...`                                                           |
| Docs update | `docs/...`                                                            |
| Examples    | `examples/...`                                                        |
| LLM prompt  | `prompts/<name>/<major>_<minor>_<patch>.md` (see `prompts/README.md`) |

## Test conventions

- **All tests live in separate files** in `tests/` — never inline in source
  files.
- Test files are named with a `_test` suffix (e.g. `export_test.ts`), per §20
  of `OSS_SPEC.md`; vitest picks up `tests/**/*_test.ts`.
- Tests cover the pure domain modules (export, search, migrations, types) and
  run in a node environment — no DOM.

## Source file size

- Non-test source files must stay under **1000 physical lines** (§20.5 of
  `OSS_SPEC.md`). Prefer splitting by concern over relaxing the cap.
- A file may opt out with `oss-spec:allow-large-file: <reason>` in its first
  20 lines; the reason must be real.

## Documentation sync points

| When you change…                    | Update…                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| the contact model or export formats | `docs/features/export.md`, `tests/export_test.ts`, `README.md`                                            |
| sync backends / encryption          | `docs/features/sync.md`, `docs/configuration.md`                                                          |
| settings surface                    | `docs/getting-started.md`                                                                                 |
| user-visible features               | a `.changes/unreleased/` changeset fragment + `docs/features/*.md` (the in-app "What's new" renders both) |

## Changelog and feature docs

Every user-visible change needs a **changeset fragment** at
`.changes/unreleased/<unix-ts>-<slug>.md`:

```
---
type: Added         # Added | Changed | Fixed | Removed | Security | Deprecated
title: Short title  # optional — a noun phrase bolded at the head of the bullet
doc: formats        # optional — the slug of a docs/features/<slug>.md feature doc
---

One sentence users will read in the changelog.
```

CI's `changeset` check fails a PR that ships user-visible behavior without one,
and the Release workflow collates the fragments into the dated `CHANGELOG.md`
sections (those released sections are **generated — never hand-edit them**). The
collator renders a bullet as
`- **<title>** — <summary> [Learn more](feature:<doc>)`. Fragment parsing lives
in `scripts/release/fragments.mjs`; see the existing fragments for the shape.

**Keep the bullet to one sentence.** The title + one-sentence summary is what
keeps the in-app "What's new" modal scannable — if you catch yourself writing a
second or third clause, the depth belongs in a feature doc, not the bullet. A
fix to a feature whose `Added` fragment is still unreleased folds into that
fragment rather than adding a sibling `Fixed` entry.

### Feature docs and "Learn more"

A **feature doc** is a long-form markdown file at `docs/features/<slug>.md` — a
`# Title` heading, then a multi-paragraph, plain second-person explanation of one
feature (English-only, no implementation jargon). The build inlines every
`docs/features/*.md` into the bundle (`src/app/changelog.ts`), and a changelog
bullet carrying `[Learn more](feature:<slug>)` opens the matching doc **in
place** inside the "What's new" modal. A feature doc exists only to back a
changelog "Learn more" link — general product docs live elsewhere under `docs/`.

**Reach for one sparingly — big features only.** Most fragments are just a
`title:` + one sentence with **no** `doc:`. Add (or extend) a doc only when the
feature genuinely can't be summarized in about two sentences — one whose honest
explanation runs to several paragraphs or a real "how it works" walkthrough. A
small setting, a visual tweak, a secondary facet of a larger feature, or a bug
fix does **not** get one.

This repo keeps a few **broad umbrella docs** — `contacts.md` (the contact
card and everything on it), `export.md` (export / import / backups), `sync.md`
(the storage backends, photo/attachment files, encryption), `namespaces.md`,
and `formats.md` — and the family of changelog bullets about one of those areas
all point their `[Learn more]` at that area's doc. When a big feature extends an
already-documented area, fold a paragraph into that area's doc rather than
spawning a new one; only a genuinely new big feature with no umbrella home earns
a new file (`formats.md` did). When you add a `doc:` slug, **create or update
`docs/features/<slug>.md` in the same PR** — a slug with no file renders an inert
dead link — and delete a doc (and its links) when you retire the feature so no
orphan doc or dead `feature:` link is left behind. `docs/` is in the changeset
skip-list, so a docs-only feature-doc edit needs no fragment of its own.

## Parity / cross-cutting rules

- `src/app/i18n/en.ts` is the catalog's type source; `sv.ts` must satisfy it —
  adding a string means adding it to **both**. A **runtime-built** key (one
  computed per item rather than written as a literal, e.g. a per-country name
  key) isn't a statically-known catalog leaf, so `t()` needs a cast at the call
  site: ``t(`prefix.${x}` as Parameters<typeof t>[0])``.
- The service-worker contract (cache id, `sw.js`, `version.json`,
  `precache-manifest.json`) is shared between `src/app/pwa.ts` and
  `pwa-plugin.ts`; change them together.
- `public/icons/*` are generated — edit `scripts/generate-icons.mjs` (and the
  hand-written `public/icons/icon.svg` to match) and rerun `make icons`.

## Maintenance skills

Per §21 of `OSS_SPEC.md`, this repo ships agent skills for keeping drift-prone
artifacts in sync with their sources of truth. Skills live under
`.agent/skills/<name>/` and are also accessible via the `.claude/skills`
symlink.

| Skill           | When to run                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `maintenance`   | When several artifacts have likely drifted at once — umbrella skill that runs every `update-*` skill in the correct order. |
| `update-docs`   | After any change to user-visible behavior, configuration keys, or the export formats.                                      |
| `update-readme` | After any change that alters user-visible behavior, commands, or install instructions.                                     |

Each skill has a `SKILL.md` (the playbook) and a `.last-updated` file (the
baseline commit hash). The `maintenance` skill owns a **Registry** table
listing every `update-*` skill — add a row whenever you create a new sync
skill.
