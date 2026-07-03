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

On a cloud drive (Dropbox or Google Drive), a contact's photos are filed out of
the document into their own **binary JPEG** files at deterministic paths — the
display crop at `photos/<name>-<id>.jpg` and the larger original at
`photos/<name>-<id>-source.jpg`, both built from the contact's name and stable
id. They are real image files you can preview in the drive, and because every
image byte moves out to a file, the synced document carries no picture data at
all — it stays small. Photos that come in on an imported vCard ride the same
path: they are broken out into files on the next save rather than bloating the
document.

The copy that lives on this device keeps its photos inline, so nothing depends
on the drive to render offline; the drive files are written on save and re-read
when a fresh device loads the document. If a file write can't complete, the
photo simply stays inline in the document that save — it is never lost.

This applies to the **plaintext** cloud copy only. With encryption on (below),
photos stay inside the encrypted envelope rather than as separate plaintext
image files on the drive.

## Encryption at rest

Flip on **Encrypt the cloud copy** and what lands on the drive is an AES-GCM
envelope keyed by your passphrase (PBKDF2-derived). The passphrase is held in
memory only — after a reload the cloud copy stays locked until you re-enter it.
