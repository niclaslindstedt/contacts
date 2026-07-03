---
type: Changed
title: Hide cloud storage backends that aren't configured in the build
---

The storage backend picker now only offers a cloud provider when its OAuth
identifier is baked into the build — Dropbox appears only when
`VITE_DROPBOX_APP_KEY` is set, Google Drive only when `VITE_GOOGLE_CLIENT_ID`
is set. Previously an unconfigured backend was still listed and showed a
"key missing" warning once selected; now it's simply absent, so the picker
only presents backends you can actually connect to. When neither key is set,
the picker shows just **This device**.
