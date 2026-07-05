# Backups

Where [import / export](feature:export) moves individual cards between address
books, a **backup** captures the _whole_ document — every contact, folder, photo,
and attachment — as a single dated snapshot. A backup is a compressed `.zip`
holding one `contacts.json` with photos and attachments inline, so it's
self-contained regardless of which backend externalises those files day to day.

From **Settings → Storage → Backups** you can **Download backup (.zip)** straight
to disk, or **Restore from file…** to replace the current document with a
downloaded snapshot (a destructive replace, so it confirms first, and files a
safety-net backup before overwriting).

When a **file-backed backend** is connected (local folder, Dropbox, or Google
Drive) and the copy isn't encrypted, **Browse backups** opens a manager over a
`backups/` folder on that backend: **Back up now** writes a fresh snapshot, and
each row can be downloaded, deleted, or restored. Snapshots are named with their
timestamp and contact/folder counts so the list reads from a directory listing
alone. Backups are per-namespace, and because a backup is plaintext the
off-device manager is hidden while **encryption at rest** is on — download and
restore from disk still work.
