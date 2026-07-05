# Cloud sync

Your contacts always live on **this device** first. Connect a cloud backend and
the app keeps a copy in sync:

- **Dropbox** — OAuth (PKCE) with silent token refresh; the document lives in the
  app's folder as `contacts-<namespace>.json`.
- **Google Drive** — Google Identity Services consent; the document lives in a
  `Contacts` folder in My Drive.

(Prefer no account or network? See [Local folder](feature:local-folder).)

Saves are debounced and retried with backoff on transient failures. Photos and
attachments are filed out of the document as real files — see
[Cloud photo files](feature:photo-files).

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
which copy wins. The **Open in {provider}** button on the sync command centre
jumps to the drive's own web UI, straight onto the synced files.

## Encryption at rest

Flip on **Encrypt the cloud copy** and what lands on the backend is an **AES-GCM**
envelope keyed by your passphrase (PBKDF2-derived). The passphrase is held in
memory only — after a reload the synced copy stays locked until you re-enter it.
For the full reference, see [the sync documentation](../sync.md).
