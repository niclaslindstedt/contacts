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

## Opening the files in the drive

The **Sync** command centre (the header glyph) shows an **Open in {provider}**
button while a cloud drive is connected. It opens the drive's own web UI in a
new tab, pointed at the synced files — the `Apps/<folder>` app folder in
Dropbox, or a filename search in Google Drive — so you can see, download, or
manage the raw `contacts-<namespace>.json` document and its photo files
directly. The button doesn't appear for the on-device backend: that copy lives
in the browser's local storage and has no web location to open.

The folder names default to `Contacts` but are build-time configurable via
`VITE_DROPBOX_APP_FOLDER` and `VITE_GDRIVE_APP_FOLDER` — set them so the link
and the displayed file location match your Dropbox app's real app folder (which
Dropbox fixes from the app config) and the My Drive folder the app creates. See
[configuration](../configuration.md).

## Photo files

On a cloud drive (Dropbox or Google Drive), each photo in a contact's gallery is
filed out of the document into its own **binary JPEG** files at deterministic
paths — the display crop at `photos/<name>-<id>-<photoId>.jpg` and the larger
original at `photos/<name>-<id>-<photoId>-source.jpg`, built from the contact's
name, stable id, and the photo's own id (so the several photos one card can hold
never collide). They are real image files you can preview in the drive, and
because every image byte moves out to a file, the synced document carries no
picture data at all — it stays small. Photos that come in on an imported vCard
ride the same path: they are broken out into files on the next save rather than
bloating the document.

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
