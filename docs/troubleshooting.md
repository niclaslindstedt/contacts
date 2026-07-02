# Troubleshooting

## `npm install` fails with 401 on `@niclaslindstedt/oss-framework`

The framework package is served from GitHub Packages, which requires
authentication even for public packages. Add a personal access token with
`read:packages` to your `~/.npmrc`:

```
//npm.pkg.github.com/:_authToken=<token>
```

## The Dropbox / Google Drive Connect button says a key is missing

The OAuth identities are baked in at build time (`VITE_DROPBOX_APP_KEY`,
`VITE_GOOGLE_CLIENT_ID`). See [configuration.md](configuration.md).

## The sync glyph shows a conflict

Another device (or tab) saved a newer copy to the backend. Open the glyph →
**Reload from the backend** to adopt the newer copy, or **Save now** to
overwrite it with this device's copy.

## The cloud copy is "locked"

Encryption at rest is on and the passphrase — held in memory only — was lost
to a reload. Settings → Storage → Unlock, re-enter the passphrase. Your local
data was never locked; only syncing paused.

## My data disappeared after clearing browser data

The document lives in `localStorage`. If a cloud backend was connected,
reconnect it and use **Reload from the backend**; otherwise restore from a
JSON backup (Settings → Storage → Export made one, hopefully). This is the
local-first trade-off — export or connect a backend for anything precious.

## The app doesn't update to the newest deploy

The service worker applies updates through the in-app prompt (sidebar → Check
for updates). If a stale worker wedges a dev machine, unregister it from the
browser's application panel and reload.
