# Configuration

All configuration is **build-time** (the app is a static PWA — there is no
server and no runtime config file). Vite reads these from the environment:

| Variable                | Default   | Purpose                                                                                                                                                                                                                                         |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`             | `/`       | The deploy base path. The Pages workflow sets `/contacts/`. Drives asset URLs, the service-worker scope, and the precache cache id.                                                                                                             |
| `VITE_DROPBOX_APP_KEY`  | _(unset)_ | Dropbox app key for the OAuth PKCE connect flow. Create a Dropbox app with the `files.content.write`/`files.content.read` scopes and an app folder; no secret is needed (PKCE). When unset, the Dropbox Connect button explains what's missing. |
| `VITE_GOOGLE_CLIENT_ID` | _(unset)_ | Google OAuth client id for the Google Identity Services token flow (`drive.file` scope). When unset, the Google Drive Connect button explains what's missing.                                                                                   |

Example production build:

```sh
VITE_BASE=/contacts/ \
VITE_DROPBOX_APP_KEY=abc123 \
VITE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com \
npm run build
```

For the GitHub Actions deploy, set `DROPBOX_APP_KEY` / `GOOGLE_CLIENT_ID` as
repository **variables** (they are public identifiers, not secrets) and the
`pages.yml` workflow passes them through.

## Where data lives on-device

Everything persists in `localStorage` under the `contacts:` prefix — the
per-namespace documents (`contacts:doc[:slug]`), settings, namespaces
registry, achievements, sync backend choice, and the offline mirror of the
cloud copy. Clearing site data resets the app.
