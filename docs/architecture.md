# Architecture

This is a **frontend-only, local-first PWA** built on
[`@niclaslindstedt/oss-framework`](https://github.com/niclaslindstedt/oss-framework).
It was seeded from the framework's reference app (its `demo/` — see the
framework's `demo/ADOPTION.md` seam manifest) and rescoped from checklists to
contacts. There is no server: the document lives on-device, and cloud sync
talks directly to Dropbox / Google Drive from the browser.

## The seam: framework vs. app

The framework owns the **mechanics and the UI kit**; the app owns the
**domain and the stores** ("store stays in the app"):

```
┌────────────────────────── app (this repo) ──────────────────────────┐
│ ContactScreen · SideMenuContent · ArchiveScreen · SearchOverlay      │
│ SettingsModal + tabs · Avatar · ContactAppearancePopover             │
│        │                                                             │
│ useContactStore (doc + undo/redo)   useNamespaces   useAppSettings   │
│ useSyncEngine (real sync)           useAchievements                  │
│ types.ts · export.ts (vCard/CSV/JSON) · search.ts · migrations.ts    │
└──────────┬───────────────────────────────────────────────┬──────────┘
           │ published subpaths only                       │
┌──────────▼───────────────────────────────────────────────▼──────────┐
│ oss-framework: Sidebar shell · Modal/panels · theme engine · glyphs  │
│ search matcher · storage adapters (browser/Dropbox/GDrive) + OAuth   │
│ withEncryption (AES-GCM) · achievements engine · i18n · logging      │
│ usePwaUpdate (SW update state machine) · namespaces model            │
└──────────────────────────────────────────────────────────────────────┘
```

Dependency direction is strictly downward: screens → stores → framework.
Nothing deep-imports framework internals.

## The document

One namespace = one document (`AppData`): folders + contacts + the active
pointer. `useContactStore` holds it in memory, persists every change to
`localStorage` (`contacts:doc[:slug]`), and stacks edits on an undo/redo
history. The bytes at rest carry a `version`; `migrations.ts` runs older
documents forward on load (`createMigrator`), so the same JSON is safe coming
from localStorage, a cloud backend, or an imported backup.

## Sync

`useSyncEngine` is the app-owned state machine the framework's `SyncStatus`
glyph and `SyncDetailsModal` paint over. The local document is always the
working copy. When a cloud backend is connected the engine:

1. watches the store's edit counter and debounces a push (serialize → adapter
   `save(text, baseRevision)`),
2. rides the framework's retry policy for transient failures, and maps the
   typed errors (`ConflictError`, `AuthError`, `RateLimitError`) onto the
   command centre's recovery affordances,
3. can pull the backend copy down (`Reload from the backend`), which adopts it
   as a new baseline.

Adapters come from the framework (`createDropboxAdapter` /
`createGdriveAdapter`), wrapped with `withLocalCache` (offline reads) and —
when the user opts in — `withEncryption`, so the cloud copy is an AES-GCM
envelope. The passphrase lives in a mutable in-memory ref; after a reload the
cloud copy is "locked" until re-entered (the framework's `UnlockGate`).

## PWA

`pwa-plugin.ts` emits at build time exactly what the framework's
`usePwaUpdate` consumes: a "prompt to update" service worker (installs, parks
in `waiting`, applies on SKIP_WAITING), `version.json`, and
`precache-manifest.json`, under a base-derived cache id (`src/app/pwa.ts`).
The worker serves the cached shell as the offline navigate fallback.

It also generates the `manifest.webmanifest` per build rather than shipping a
static one, because the install identity must differ per release channel. The
`id`, `start_url`, and `scope` members are resolved against the _origin_ (not
the manifest URL) by some engines — notably iOS Safari's "Add to Home Screen"
— so a relative `"./"` collapses every channel onto the root app. The plugin
pins them (and the icon `src`s) to the absolute deploy `base` and gives each
channel a distinct tile name, so `/`, `/preview/`, and `/branch/` install as
separate apps.

Because the release/preview/branch channels share one origin (the custom domain),
each build's base gives it a unique scope and cache id, and the root release
passes `VITE_PWA_IGNORE_PATHS` so its worker disowns the sibling channels nested
under it (its scope `/` is a prefix of `/preview/` and `/branch/`). See
[configuration](configuration.md#release-channels).

## Output

`src/output.ts` is the central output module (OSS_SPEC §19.4): semantic
helpers (`status`/`info`/`warn`/`error`/`header`) over the in-app log store,
which the Logs settings tab and the sync command centre's log panel render.
