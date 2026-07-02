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

## Commit and PR conventions

- All commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- PRs are squash-merged; the **PR title** becomes the single commit on `main`,
  so it must follow conventional-commit format.
- Breaking changes use `<type>!:` or a `BREAKING CHANGE:` footer.

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

| When you change…                    | Update…                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| the contact model or export formats | `docs/features/export.md`, `tests/export_test.ts`, `README.md`                       |
| sync backends / encryption          | `docs/features/sync.md`, `docs/configuration.md`                                     |
| settings surface                    | `docs/getting-started.md`                                                            |
| user-visible features               | `CHANGELOG.md` bullets + `docs/features/*.md` (the in-app "What's new" renders both) |

## Parity / cross-cutting rules

- `src/app/i18n/en.ts` is the catalog's type source; `sv.ts` must satisfy it —
  adding a string means adding it to **both**.
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
