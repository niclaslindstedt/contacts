---
type: Added
title: Sync to a local folder on your computer
---

A new **Local folder** storage backend syncs your address book to a directory
you pick on this computer — no account, no network. Choose it from Settings →
Storage → _Where your data lives_ and pick a folder; the app writes your
contacts as `contacts-<namespace>.json` in it, with each contact's photos and
attachments filed beside the document under `photos/` and `attachments/` as real
image and document files. The result is a browsable, git-trackable tree you can
back up, diff, or edit with other tools.

The browser remembers the folder you picked, so it reconnects on the next visit.
When a browser resets that permission between sessions, Settings → Storage and
the sync command centre show a one-click **Reconnect folder** prompt — your data
is untouched, only the grant is renewed. Encryption at rest works here too: with
it on, what lands in the folder is an AES-GCM envelope instead of plaintext
files.

The backend uses the browser's File System Access API, so it appears only in
Chromium-based browsers (Chrome, Edge, Opera, Brave, Arc); elsewhere the option
is hidden and the cloud backends or the on-device copy are used instead.
