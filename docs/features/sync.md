# Cloud sync

Your contacts always live on this device first. Connect a cloud drive and the
app keeps a copy in sync:

- **Dropbox** — OAuth (PKCE) with silent token refresh; the document lives in
  the app's folder as `contacts-<namespace>.json`.
- **Google Drive** — Google Identity Services consent; the document lives in a
  `Contacts` folder in My Drive.

Saves are debounced, retried with backoff on transient failures, and guarded by
optimistic concurrency — if another device saved a newer copy, the header glyph
flags a conflict and you choose which copy wins.

## Photo files

On a cloud drive (Dropbox or Google Drive), each contact's original photo is
filed out of the document into its own file at a deterministic path —
`photos/<name>-<id>.jpg`, built from the contact's name and stable id — so a
photo is easy to find in the drive and the synced document stays small. The
copy that lives on this device keeps its photos inline, so nothing depends on
the drive to render offline; the drive file is written on save and re-read when
a fresh device loads the document. If a file write can't complete, the photo
simply stays inline in the document that save — it is never lost.

This applies to the **plaintext** cloud copy only. With encryption on (below),
photos stay inside the encrypted envelope rather than as separate plaintext
image files on the drive.

## Encryption at rest

Flip on **Encrypt the cloud copy** and what lands on the drive is an AES-GCM
envelope keyed by your passphrase (PBKDF2-derived). The passphrase is held in
memory only — after a reload the cloud copy stays locked until you re-enter it.
