# Configuration

All configuration is **build-time** (the app is a static PWA — there is no
server and no runtime config file). Vite reads these from the environment:

| Variable                  | Default                                                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`               | `/`                                                            | The deploy base path. Drives asset URLs, the service-worker scope, and the precache cache id. The site is served from the custom domain (`contacts.niclaslindstedt.se`); each release channel builds at its own base: `/` (release), `/preview/` (main), `/branch/` (the on-demand branch slot).                                                                                                                                                               |
| `VITE_PWA_IGNORE_PATHS`   | _(unset)_                                                      | Comma-separated absolute paths the service worker must **disown** — the sibling channels nested under this build's base. Only the root release sets it (`/preview/,/branch/`); its worker's scope `/` is a prefix of the siblings, so without this it would serve the released shell in place of a preview/branch page.                                                                                                                                        |
| `VITE_DROPBOX_APP_KEY`    | _(unset)_                                                      | Dropbox app key for the OAuth PKCE connect flow. Create a Dropbox app with the `files.content.write`/`files.content.read` scopes and an app folder; no secret is needed (PKCE). When unset, Dropbox is hidden from the storage backend picker.                                                                                                                                                                                                                 |
| `VITE_GOOGLE_CLIENT_ID`   | _(unset)_                                                      | Google OAuth client id for the Google Identity Services token flow (`drive.file` scope). When unset, Google Drive is hidden from the storage backend picker.                                                                                                                                                                                                                                                                                                   |
| `VITE_DROPBOX_APP_FOLDER` | `Contacts`                                                     | The name of the Dropbox **app folder** (`Apps/<name>/`), fixed by your Dropbox app's configuration. Sets where the "Open in Dropbox" link and the "File location" line in the sync command centre point; it does not create the folder (Dropbox does). Set it to match your app's real folder name when it isn't `Contacts`.                                                                                                                                   |
| `VITE_GDRIVE_APP_FOLDER`  | `Contacts`                                                     | The name of the Google Drive folder created in the user's My Drive to hold the synced document. Unlike Dropbox, this folder **is** created by the app, so changing this both files documents under the new folder name and updates the "File location" line. Defaults to `Contacts`.                                                                                                                                                                           |
| `VITE_SEED`               | _(unset)_                                                      | Boot into a developer in-memory backend, seeded with sample contacts. `1`/`true`/`sample` loads the curated edge-case set; a number loads roughly that many contacts; `large` loads a big stress-test spread; `demo` loads the presentation-grade demo address book; `0` or unset starts on the real address book. In-memory only — nothing is persisted. `npm run dev` sets this to `large` by default. See [Fake data](#fake-data--seeded-dev-server) below. |
| `VITE_DONATE_URL`         | [GitHub Sponsors](https://github.com/sponsors/niclaslindstedt) | The link target for the side menu's **Donate** row. Set it to point the button at a different sponsorship page; when unset it falls back to the project's GitHub Sponsors page.                                                                                                                                                                                                                                                                                |

Example production build:

```sh
VITE_BASE=/ \
VITE_DROPBOX_APP_KEY=abc123 \
VITE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com \
npm run build
```

For the GitHub Actions deploy, set `VITE_DROPBOX_APP_KEY` /
`VITE_GOOGLE_CLIENT_ID` / `VITE_DROPBOX_APP_FOLDER` / `VITE_GDRIVE_APP_FOLDER` /
`VITE_DONATE_URL` as repository **variables** (they are public identifiers, not
secrets) and the deploy workflows pass them through under the same names.

## Fake data / seeded dev server

`npm run dev` starts **seeded by default** (it runs `VITE_SEED=large vite`): the
dev server comes up on a throwaway sample address book full of varied edge-case
contacts — nameless / company-only cards, very long and unicode/RTL text, many
phones and emails, leap-day and far-past/future birthdays, every phone and
postal-code style, archived cards, and empty and archived folders — so the UI,
search, sort, export, and formatters always have realistic input.

- **How much:** `VITE_SEED=1` (or `sample`) loads just the curated edge-case
  set; a number (`VITE_SEED=250`) loads roughly that many contacts; `large`
  loads a big stress-test spread. Override the default per run, e.g.
  `VITE_SEED=25 npm run dev`.
- **Turn it off:** `npm run dev:clean` (or `VITE_SEED=0 npm run dev`) starts on
  your real, persisted address book.
- **In the app:** the **Settings → Developer → Fake data** toggle flips the same
  seed on and off live, without a rebuild (enable developer mode in
  Settings → General first).

### Demo data

Alongside the edge-case fake data there is a **demo** dataset — a polished,
presentation-grade address book of about a hundred realistic (but entirely
fictional) contacts: family with birthdays and name days, friends at home and
abroad, colleagues and clients, the kids' school circle, and a folder of
household services, complete with favorites, emergency contacts, notes, nested
folders, archived cards, and a couple of PDF attachments. It's made for demos
and screenshots rather than stress-testing. Load it with the
**Settings → Developer → Demo data** toggle (mutually exclusive with Fake
data), or boot straight into it with `VITE_SEED=demo npm run dev`.

Both seeds are storage backends that **take over storage, entirely in memory**
— nothing is ever written to disk, and no seeded data is pushed to a connected
cloud copy. Reloading the page (or toggling it off) restores the real document
untouched. Because a production build never sets `VITE_SEED`, shipped builds
always start on real data.

## Release channels

The app deploys to three coexisting channels on the custom domain
(`contacts.niclaslindstedt.se`). All three are built by `pages.yml` into a single
GitHub Pages artifact (`actions/upload-pages-artifact` → `actions/deploy-pages`),
with each channel merged in at its own subpath:

| Channel | Trigger                                          | Path        | Workflow                    |
| ------- | ------------------------------------------------ | ----------- | --------------------------- |
| release | `release.yml` dispatch (chains into `pages.yml`) | `/`         | `release.yml` → `pages.yml` |
| preview | every commit on `main`                           | `/preview/` | `pages.yml`                 |
| branch  | `pages.yml` dispatch with a `branch_ref`         | `/branch/`  | `pages.yml`                 |

The production `/` build comes from the highest `v*` tag (empty until the first
release, when `main` is served at `/` instead). The `/preview/` build is the
current `main`. The `/branch/` slot is a single, on-demand slot: dispatch
`pages.yml` with a `branch_ref` to park a branch there, and it persists across
later deploys via the auto-managed `branch-deploy` orphan branch until the next
dispatch overwrites it.

Because the channels share one origin, each build gets its own base path (so its
service-worker scope and precache cache id are unique) and the root release lists
its siblings in `VITE_PWA_IGNORE_PATHS` so its worker disowns their pages. Only
the root artifact carries the domain's `CNAME` (from `public/`); the per-slot
copies strip it so a single root file owns the domain.

> **Pages source:** the site is published from the workflow artifact, so Pages
> must be configured to **deploy from GitHub Actions** (Settings → Pages →
> Source), not from a branch.

## Where data lives on-device

Everything persists in `localStorage` under the `contacts:` prefix — the
per-namespace documents (`contacts:doc[:slug]`), settings, namespaces
registry, achievements, sync backend choice, and the offline mirror of the
cloud copy. The one exception is the **local-folder** backend's picked-directory
handle, which is kept in IndexedDB (localStorage can't hold a
`FileSystemDirectoryHandle`) so the folder grant survives reloads. Clearing site
data resets the app.
