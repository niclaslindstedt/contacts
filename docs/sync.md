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
which copy wins. The very first save after opening waits for the initial read of
the backend to finish, so it always pushes against the copy that's really there;
your edit stays safe on this device in the meantime and syncs the moment that
read lands. (Without the wait, editing on a slow connection right as the app
opened could push against an unknown copy and trip a spurious conflict.)

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
[configuration](./configuration.md).

## The on-device copy

Whatever backend you sync to, a copy of the current address book always lives on
this device (in the browser's local storage) — the working copy the screens read
and edit. That copy is kept **non-destructively**, so a hiccup can't quietly wipe
it:

- After an **app update**, a still-running older build can briefly read a
  document the newer build already upgraded and fail to make sense of it. When
  that happens the stored copy is **left untouched** (and a spare is quarantined
  for recovery) rather than being replaced with a blank one — it reappears on its
  own once the update settles. The event is logged to **Settings → Logs** instead
  of passing silently.
- If the browser's storage is **full**, the app still keeps every contact by
  saving a slimmed copy without the cached photo/attachment bytes (a connected
  drive re-hydrates those) instead of failing the whole save.

Your cloud copy is never touched by any of this — it only concerns the copy held
on the device.

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

### Finding lost or dropped photos

Because the file names are deterministic, the layout is also **self-healing**.
When the app opens a folder or cloud copy it scans the `photos/` tree and, for
any image file the document doesn't already reference, reads the contact id and
photo id back out of the file name and re-attaches the photo to that contact.
Two things fall out of this:

- A photo whose reference somehow went missing from the document — but whose
  file is still on the drive — is **found and re-indexed** onto its contact the
  next time the app opens, rather than lingering as a stray file.
- You can **drop an image into the `photos/` folder yourself** and have it picked
  up. Name it so it carries the target contact's id and a photo id —
  `photos/<any-readable-name>-<contactId>-<photoId>.jpg` (add `-source.jpg` for a
  re-croppable original) — the simplest way is to copy an existing photo file's
  name and change the photo id. The leading name part is cosmetic; only the
  contact id has to match a real card. On the next open the app adopts the file
  onto that contact and, on the following save, records the reference in the
  document.

This reconciliation runs automatically each time the app opens the backend. You
can also trigger it on demand from **Settings → Developer → Photos → Reindex
photos** — handy right after dropping files in, or to recover lost photos without
reloading. The button reports how many it reconnected, and **Settings →
Developer → Logs** carries the per-file detail: one line per reconnected file
naming its contact, and a warning for any file whose contact id no longer matches
a card (the usual reason a photo won't reconnect — its card was re-created with a
new id).

This applies to the **plaintext** folder or cloud copy only. With encryption on
(below), photos stay inside the encrypted envelope rather than as separate
plaintext image files.

## Attachment files

Contact **attachments** (see [Contact cards](./contacts.md)) are filed out
the same way. On a folder or cloud backend each attachment's bytes move into
their own file under `attachments/<name>-<id>-<attachId>.<ext>`, keeping the
original file
extension so what lands on the drive is a genuine, previewable file (a `.pdf` is
a PDF), and the synced document carries only the path — not the file bytes — so
it stays small. As with photos, the copy on this device keeps attachments inline
for offline use, a file that can't be written stays inline rather than being
lost, and orphaned files are pruned once a save commits. With encryption on,
attachments stay inside the encrypted envelope instead.

## Backup files

Dated **backups** (see [Export & import](./export.md)) also live on a
folder or cloud backend, under a `backups/` folder beside the document. Each is
a self-contained, compressed `.zip` of the whole address book named
`contacts-<namespace>-<timestamp>-c<contacts>-f<folders>.zip`; **Settings →
Storage → Backups → Browse backups** lists, takes, downloads, and restores them.
Because a backup is plaintext, the off-device manager is hidden while encryption
at rest is on — downloading and restoring from disk still work.

## Encryption at rest

Flip on **Encrypt the cloud copy** and what lands on the backend is an AES-GCM
envelope keyed by your passphrase (PBKDF2-derived) — this applies to the local
folder as well as the cloud drives. The passphrase is held in memory only —
after a reload the synced copy stays locked until you re-enter it.
