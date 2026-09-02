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
│ ContactScreen (read/edit views) · SideMenuContent · ArchiveScreen    │
│ SearchOverlay · SettingsModal + tabs · Avatar · appearance popover   │
│        │                                                             │
│ useContactStore (doc + undo/redo)   useNamespaces   useAppSettings   │
│ useSyncEngine (real sync)           useAchievements  useAppRoute     │
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

## Rendering runtime

The renderer is **Preact**, not React. Nothing from React ships: the app
depends on `preact` alone, and `@preact/preset-vite` compiles JSX against
`preact/jsx-runtime` and aliases `react`, `react-dom`, and their
`/jsx-runtime` + `/client` subpaths onto `preact/compat`. That swap is worth
roughly 190 kB of raw JavaScript (~53 kB gzipped) off the main bundle — the
whole point of it is the download, so keep it that way.

Two seams keep the alias honest:

- **The framework is built against React.** Its published chunks import
  `react` / `react-dom` / `react/jsx-runtime` as externals and its `.d.ts`
  files take their types from `react`. Both are resolved to Preact rather than
  rewritten: the bundler by the preset's aliases, `tsc` by the matching
  `paths` in `tsconfig.json`. `package.json` `overrides` point npm's `react`
  and `react-dom` at `@preact/compat` so the framework's peer dependency
  resolves to the same thing and no React copy is installed at all.
- **App code still imports from `"react"`.** That is deliberate, and the
  supported Preact migration path — `preact/compat` is in the bundle for the
  framework's sake regardless, so importing `preact/hooks` directly would save
  nothing while making the app's types disagree with the framework's props.
  `src/main.tsx` is the exception: it mounts with Preact's own `render`, since
  there is no root object to create and no `StrictMode` double-render to opt
  into.

Preact is a re-implementation, not a fork, so a handful of React behaviours
only hold because `preact/compat` restores them — most importantly `onChange`
on a text field, which Preact would otherwise fire on commit rather than per
keystroke (compat remaps it to `oninput`). Two React-isms it does **not**
paper over, and which the codebase therefore avoids: an event handler's
`target` is typed as the bare `EventTarget` (use `currentTarget`, which is the
element the handler is bound to), and string-valued attributes such as SVG's
`focusable` want `"false"`, not a JSX boolean.

## What loads when

There is no server and no prerender, so every byte of the app is downloaded
before anything appears. Boot therefore carries only what the first screen
needs; the rest is behind `import()`. What is deferred today:

| Chunk                                       | Loads when                        |
| ------------------------------------------- | --------------------------------- |
| `ChangelogPanel` (CHANGELOG + feature docs) | "What's new" is opened            |
| `SettingsModal` + its tabs                  | Settings is opened                |
| `CloudSetupModal`                           | a cloud backend is connected      |
| `seedBackend` (+ `fakeData` / `demoData`)   | a Developer data toggle turns on  |
| `demoPhotos`                                | demo mode turns on                |
| `PrivacyPage` / `ShowcasePage`              | their own route is the one served |
| the `sv` catalogue                          | Swedish is selected               |

`main.tsx` picks exactly one page per route, so the app bundle never reaches
`/privacy/` or `/home/` and neither page reaches the app.

Two rules keep this honest, both learned the hard way:

- **Measure in a browser, not in the build log.** An entry chunk that shrank
  because its contents moved into a sibling chunk it imports on the next line
  has saved nothing. What counts is the JS a route actually fetches — and when
  measuring that, block the service worker, whose precache pulls _every_ asset
  and hides the difference entirely.
- **`build.modulePreload.resolveDependencies` in `vite.config.ts` is
  load-bearing.** Vite wraps each `import()` in a preload helper carrying that
  call's dependency list, and the minifier folds the route switch in
  `main.tsx` into a single call however the source is written — so that helper
  would preload the union of all three branches and `/privacy/` would eagerly
  fetch the whole app. Dropping the JS-side dependency hints is what makes the
  page splits real; the entry's own HTML preload tags are kept.

Not everything that looks splittable is. A modal that shares a framework chunk
with something the first screen already needs — `SyncDetailsModal` with
`SyncStatus`, the achievements and namespaces modals with the watcher and the
favicon helpers — moves no bytes when deferred, and the `lazy()` wrapper costs
more than it saves. Those stay statically imported on purpose.

## The document

One namespace = one document (`AppData`): folders + contacts + the active
pointer. `useContactStore` holds it in memory, persists every change to
`localStorage` (`contacts:doc[:slug]`), and stacks edits on an undo/redo
history. The bytes at rest carry a `version`; `migrations.ts` runs older
documents forward on load (`createMigrator`), so the same JSON is safe coming
from localStorage, a cloud backend, or an imported backup.

## Navigation

There is no router library. `route.ts` defines the whole navigation contract —
a browse screen (`list` / `favorites` / `archive`) plus the card floating over
it — and its `#/…` spelling; `useAppRoute` mirrors that route into the browser's
history and hands popped routes back to `App`, which applies them as state. The
app state stays the source of truth: the screens go on calling `setView` /
`setActive`, and the hook only reflects where that lands.

The **main area is always a browse screen** — a contact card never takes it
over. Every way into a card (a List / Favorites row, a side-menu pick, a search
hit, a freshly created or pasted contact) funnels through `App`'s
`openContactModal`, which surfaces the card in the shell's swipe-down `Modal`
over the page underneath; `ContactScreen` renders only there. The card the
route carries is therefore always the one floating over the named screen, so
closing it lands back on the browse page rather than on whatever came before.
The card used to be a screen of its own, spelled `#/contact/<id>`; `parseRoute`
still reads those links, mapping them onto the List page with that card open.

The route rides in the **hash**, not the path. The pathname is already spoken
for — the build serves the same bundle at `/privacy/` and `/home/` (see
`main.tsx` and the alias plugins in `vite.config.ts`) — and GitHub Pages would
404 a made-up path like `/contact/abc` on reload, while a hash always reaches
`index.html`. Each move writes one history entry (`pushState`), so Back steps
to the previously open card; a move the user didn't make — the pointer stepping
off a card that was just deleted or archived — rewrites the current entry
(`replaceState`) instead, so Back never lands on a card that is gone.

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

## Photo transport

Photos are the one part of the document big enough to need a transport of its
own, and `withExternalPhotos` (`photoStore.ts`) is it: on a plaintext file
backend every image is filed out to a real binary JPEG at a deterministic path
and stripped from the synced document, then read back on load.

On a **cloud** backend that wrapper runs `tiered`, which splits the reads in two
— the design decision worth knowing here. The stored display crop is baked at
512 square but never drawn above 96 CSS px (the `hero` avatar; the lightbox
shows `photoSource`), and the kept original isn't needed to open the app at all.
So:

- **Render tier** (`atlas.ts`, `atlasTile.ts`, `atlasStore.ts`) — every crop
  re-encoded to a 288 px tile and batched into immutable, content-addressed ZIP
  packs under `photos/atlas/`, read on open in a handful of requests. Tiles land
  on `ContactPhoto.photoTile`; `serializeDoc` strips them, so the render tier
  never enters the document or the localStorage copy. It is derived and
  disposable — a missing or unreadable pack costs a lazy archival read, never a
  photo — which is why it needs no locks and no shared mutable index: pack ids
  are the hash of their own bytes, and each pack's index rides inside it.
- **Archival tier** — the per-photo files, unchanged, read only when the atlas
  didn't cover a crop. Originals are fetched on demand by `photoSource.ts` when
  a lightbox or the cropper asks.

A **local folder** is deliberately untiered: no rate limit to dodge, and a
browsable tree of real image files is the point of that backend. Encrypted
copies skip the whole layer and keep photos inside the envelope.

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
