---
type: Added
title: Make the Dropbox and Google Drive app-folder names configurable
---

The cloud app-folder name is no longer hardcoded to `Contacts`. Two new
build-time variables — `VITE_DROPBOX_APP_FOLDER` and `VITE_GDRIVE_APP_FOLDER`
(settable as GitHub repository variables) — set the Dropbox app folder the
**Open in Dropbox** link and the "File location" line point at (Dropbox fixes
this name from your app's own config, so it isn't always `Contacts`) and the
Google Drive folder the app creates in My Drive. Both default to `Contacts`
when unset.
