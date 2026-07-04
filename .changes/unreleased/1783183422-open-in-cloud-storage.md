---
type: Added
title: Add an "Open in {provider}" button to the sync command centre
---

The **Sync** command centre now shows an **Open in Dropbox** / **Open in Google
Drive** button when a cloud drive is connected. It opens the drive's web UI in a
new tab straight onto the synced files — the app folder in Dropbox, or a
filename search in Google Drive — so you can see, download, or manage the raw
`contacts-<namespace>.json` document (and its photo files) yourself. The button
is hidden for the on-device backend, which keeps its copy in the browser's
local storage with nothing to open.
