# Configuration

All configuration is **build-time** (the app is a static PWA — there is no
server and no runtime config file). Vite reads these from the environment:

| Variable                | Default   | Purpose                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`             | `/`       | The deploy base path. Drives asset URLs, the service-worker scope, and the precache cache id. The site is served from the custom domain (`contacts.niclaslindstedt.se`); each release channel builds at its own base: `/` (release), `/preview/` (main), `/branch/<name>/` (feature branch).                            |
| `VITE_PWA_IGNORE_PATHS` | _(unset)_ | Comma-separated absolute paths the service worker must **disown** — the sibling channels nested under this build's base. Only the root release sets it (`/preview/,/branch/`); its worker's scope `/` is a prefix of the siblings, so without this it would serve the released shell in place of a preview/branch page. |
| `VITE_DROPBOX_APP_KEY`  | _(unset)_ | Dropbox app key for the OAuth PKCE connect flow. Create a Dropbox app with the `files.content.write`/`files.content.read` scopes and an app folder; no secret is needed (PKCE). When unset, the Dropbox Connect button explains what's missing.                                                                         |
| `VITE_GOOGLE_CLIENT_ID` | _(unset)_ | Google OAuth client id for the Google Identity Services token flow (`drive.file` scope). When unset, the Google Drive Connect button explains what's missing.                                                                                                                                                           |

Example production build:

```sh
VITE_BASE=/ \
VITE_DROPBOX_APP_KEY=abc123 \
VITE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com \
npm run build
```

For the GitHub Actions deploy, set `DROPBOX_APP_KEY` / `GOOGLE_CLIENT_ID` as
repository **variables** (they are public identifiers, not secrets) and the
deploy workflows pass them through.

## Release channels

The app deploys to three coexisting channels on the custom domain
(`contacts.niclaslindstedt.se`), each a sibling subtree of the `gh-pages` branch
(published by `scripts/deploy-pages.sh`):

| Channel | Trigger                | Path              | Workflow             |
| ------- | ---------------------- | ----------------- | -------------------- |
| release | a `v*` tag             | `/`               | `release.yml`        |
| preview | every commit on `main` | `/preview/`       | `pages.yml`          |
| branch  | every push to a branch | `/branch/<name>/` | `branch-preview.yml` |

Because the channels share one origin, each build gets its own base path (so its
service-worker scope and precache cache id are unique) and the root release lists
its siblings in `VITE_PWA_IGNORE_PATHS` so its worker disowns their pages. Only
the root release carries the domain's `CNAME` (from `public/`); the preview and
branch builds strip it so a single root file owns the domain. A branch channel is
removed automatically when the branch is deleted.

> **Pages source:** because the three channels must coexist as subpaths — which
> `actions/deploy-pages` (whole-site replacement) cannot do — Pages must be
> configured to **deploy from the `gh-pages` branch (root)**, not from GitHub
> Actions.

## Where data lives on-device

Everything persists in `localStorage` under the `contacts:` prefix — the
per-namespace documents (`contacts:doc[:slug]`), settings, namespaces
registry, achievements, sync backend choice, and the offline mirror of the
cloud copy. Clearing site data resets the app.
