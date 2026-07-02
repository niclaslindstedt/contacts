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

## Encryption at rest

Flip on **Encrypt the cloud copy** and what lands on the drive is an AES-GCM
envelope keyed by your passphrase (PBKDF2-derived). The passphrase is held in
memory only — after a reload the cloud copy stays locked until you re-enter it.
