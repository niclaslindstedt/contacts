# Cloud sync

Your contacts always live on **this device** first. Connect a cloud backend and
the app keeps a copy in sync:

- **Dropbox** — OAuth (PKCE) with silent token refresh; the document lives in the
  app's folder as `contacts-<namespace>.json`.
- **iCloud Drive** — in the App Store app only. See below.

(Prefer no account or network? See [Local folder](feature:local-folder).)

Saves are debounced and retried with backoff on transient failures. Photos and
attachments are filed out of the document as real files — see
[Cloud photo files](feature:photo-files).

## iCloud Drive

In the [App Store app](feature:native-app) there is a fourth choice, and it's
the simplest one: **iCloud Drive**. There's no account to create and no consent
screen — your iPhone or iPad is already signed in to iCloud, so connecting is a
single tap and your address book starts following you between your own devices.
Nobody else is holding the file.

What lands there is an ordinary folder. The app files its document, your photos,
your attachments and your dated backups into its own **Contacts** folder in
iCloud Drive, so you can open it in the Files app on any of your devices and see
exactly what's synced — or copy the whole thing somewhere else as a backup.

If a device isn't signed in to iCloud (or iCloud Drive is switched off), the app
says so instead of failing quietly, and picks up as soon as you turn it on. The
option simply isn't offered in a browser, because a browser can't write to your
iCloud Drive.

## Choosing which copy wins when connecting

When you connect a drive that **already holds an address book**, the app doesn't
silently pick a side. If the cloud copy differs from this device, a prompt asks
which one to keep — **Use the cloud copy** (this device adopts what's on the
drive) or **Replace with this device** (your local contacts overwrite the cloud)
— each side showing how many contacts and folders it holds. Auto-save is held
until you choose, and the prompt only appears at connect time.

## Conflicts

Once connected, saves are guarded by **optimistic concurrency**: if another
device saved a newer copy, the header glyph flags a **conflict** and you choose
which copy wins. The first save after opening waits for the app's initial read
of the backend to finish before pushing, so editing the moment the app opens on
a slow connection can't trip a spurious conflict — your edit waits safely on this
device and syncs as soon as that read lands. The **Open in {provider}** button on
the sync command centre jumps to the drive's own web UI, straight onto the synced
files.

## Encryption at rest

Flip on **Encrypt the cloud copy** and what lands on the backend is an **AES-GCM**
envelope keyed by your passphrase (PBKDF2-derived). The passphrase is held in
memory only — after a reload the synced copy stays locked until you re-enter it.
For the full reference, see [the sync documentation](../sync.md).
