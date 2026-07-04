# Sync

Your contacts always live on this device first. Connect a backend and the app
keeps a copy in sync:

- **Local folder** — a folder on this computer, picked through the browser's
  File System Access API; the document lives in it as `contacts-<namespace>.json`
  with photos and attachments filed beside it as real files. No account, no
  network. Available in Chromium-based browsers (Chrome, Edge, Opera, Brave,
  Arc); hidden elsewhere.
- **Dropbox** — OAuth (PKCE) with silent token refresh; the document lives in
  the app's folder as `contacts-<namespace>.json`.
- **Google Drive** — Google Identity Services consent; the document lives in a
  `Contacts` folder in My Drive.

Saves are debounced, retried with backoff on transient failures, and guarded by
optimistic concurrency — if another device (or another tool editing the same
folder) saved a newer copy, the header glyph flags a conflict and you choose
which copy wins.

## Local folder

The **Local folder** backend syncs to a directory you pick on this computer,
using the browser's File System Access API — so it works with no account and no
network at all. The document is written as `contacts-<namespace>.json` in the
picked folder, and (in the plaintext case) each contact's photos and attachments
are filed beside it under `photos/` and `attachments/` as real image and
document files. The result is a browsable, git-trackable tree you can back up,
diff, or edit with other tools.

The browser remembers the folder you picked (the grant is persisted), so it
reconnects automatically on the next visit. Browsers periodically reset that
grant between sessions for safety; when that happens the Sync command centre and
Settings → Storage show a **Reconnect folder** prompt that re-confirms access in
one click — your data is untouched, only the permission needs renewing.

The picker is only offered in browsers that expose the File System Access API
(Chromium-based ones today). In Firefox and Safari the option is hidden, and the
cloud backends or the on-device copy are used instead.

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
directly. The button doesn't appear for the on-device backend (that copy lives
in the browser's local storage and has no web location) or the local folder —
for the folder you already picked the directory, so you can open it in your file
manager directly; the command centre shows its path (`<folder>/contacts-<namespace>.json`).

The folder names default to `Contacts` but are build-time configurable via
`VITE_DROPBOX_APP_FOLDER` and `VITE_GDRIVE_APP_FOLDER` — set them so the link
and the displayed file location match your Dropbox app's real app folder (which
Dropbox fixes from the app config) and the My Drive folder the app creates. See
[configuration](../configuration.md).

## Photo files

On a folder or cloud backend (local folder, Dropbox, or Google Drive), each
photo in a contact's gallery is filed out of the document into its own **binary
JPEG** files at deterministic paths — the display crop at
`photos/<name>-<id>-<photoId>.jpg` and the larger
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

This applies to the **plaintext** folder or cloud copy only. With encryption on
(below), photos stay inside the encrypted envelope rather than as separate
plaintext image files.

## Attachment files

Contact **attachments** (see [Contact cards](feature:contacts)) are filed out
the same way. On a folder or cloud backend each attachment's bytes move into
their own file under `attachments/<name>-<id>-<attachId>.<ext>`, keeping the
original file
extension so what lands on the drive is a genuine, previewable file (a `.pdf` is
a PDF), and the synced document carries only the path — not the file bytes — so
it stays small. As with photos, the copy on this device keeps attachments inline
for offline use, a file that can't be written stays inline rather than being
lost, and orphaned files are pruned once a save commits. With encryption on,
attachments stay inside the encrypted envelope instead.

## Encryption at rest

Flip on **Encrypt the cloud copy** and what lands on the backend is an AES-GCM
envelope keyed by your passphrase (PBKDF2-derived) — this applies to the local
folder as well as the cloud drives. The passphrase is held in memory only —
after a reload the synced copy stays locked until you re-enter it.
