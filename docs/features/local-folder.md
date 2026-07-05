# Local folder

The **Local folder** backend syncs your address book to a directory you pick on
this computer, using the browser's **File System Access API** — so it works with
**no account and no network** at all. Choose it from **Settings → Storage** and
pick a folder.

The document is written as `contacts-<namespace>.json` in the folder, and each
contact's photos and attachments are filed beside it under `photos/` and
`attachments/` as real image and document files. The result is a **browsable,
git-trackable tree** you can back up, diff, or edit with other tools.

The browser remembers the folder you picked, so it reconnects automatically on
the next visit. Browsers periodically reset that grant for safety; when that
happens, a one-click **Reconnect folder** prompt renews access — your data is
untouched. Encryption at rest works here too, writing an AES-GCM envelope instead
of plaintext files.

The picker is only offered in browsers that expose the File System Access API
(Chromium-based ones — Chrome, Edge, Opera, Brave, Arc); in Firefox and Safari
the option is hidden and the [cloud backends](feature:cloud-sync) or the
on-device copy are used instead.
