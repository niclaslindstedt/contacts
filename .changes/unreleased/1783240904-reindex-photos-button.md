---
type: Added
title: A "Reindex photos" recovery button in Developer settings
---

**Settings → Developer → Photos** now has a **Reindex photos** button. It
rescans the connected drive's `photos/` folder and reconnects any photo file
that isn't linked to a contact — the manual counterpart to the automatic
re-index that runs on load. Use it to recover photos whose links went missing,
or to pull in images you dropped into the folder yourself under the
`photos/<name>-<contactId>-<photoId>.jpg` pattern, without waiting for a reload.

The button reports how many photos it reconnected, and the reconcile now writes
a detailed trace to **Settings → Developer → Logs** — one line per file naming
the contact it reconnected to, and a warning for any file whose contact id no
longer matches a card — so a stale or renamed id is easy to spot.

Reindexing needs a plaintext local-folder, Dropbox, or Google Drive backend;
with encryption on, photos live inside the encrypted envelope rather than as
separate files, so there is nothing to reindex.
