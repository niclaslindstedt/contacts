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

## Connecting a drive that already has contacts

When you connect a cloud drive that **already holds an address book**, the app
doesn't silently pick a side. If the cloud copy differs from the contacts on
this device, a prompt opens and asks which one to keep:

- **Use the cloud copy** — this device steps aside and adopts what's already on
  the drive.
- **Replace with this device** — your local contacts are pushed up, overwriting
  the cloud copy.

Each side shows how many contacts and folders it holds, and auto-save is held
until you choose — so an edit can't decide for you. The prompt only appears at
connect time: an empty drive, or one that already matches this device, connects
without interruption. (Once connected, a later divergence between devices is a
_conflict_, handled by the header glyph as above.)

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

A document synced before this file layout existed keeps its photos inline in the
cloud copy. The app **migrates it automatically**: when it opens and finds a
cloud copy that still embeds photos, it files them out once in the background —
no edit or manual save needed. After that one sweep the drive holds the image
files and the document holds only their paths.

This applies to the **plaintext** cloud copy only. With encryption on (below),
photos stay inside the encrypted envelope rather than as separate plaintext
image files on the drive.

## Encryption at rest

Flip on **Encrypt the cloud copy** and what lands on the drive is an AES-GCM
envelope keyed by your passphrase (PBKDF2-derived). The passphrase is held in
memory only — after a reload the cloud copy stays locked until you re-enter it.
