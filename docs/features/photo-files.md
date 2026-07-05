# Cloud photo files

On a folder or cloud backend (local folder, Dropbox, or Google Drive), each
photo in a contact's gallery is filed out of the document into its own **binary
JPEG** — a display crop at `photos/<name>-<id>-<photoId>.jpg` and the larger
original beside it — instead of riding along as base64 text. They're real image
files you can preview in the drive, and because every image byte moves out to a
file, the synced document carries no picture data at all and stays small. Photos
that arrive on an imported vCard are broken out the same way on the next save.

The copy on **this device** keeps its photos inline, so nothing depends on the
drive to render offline. A document synced before this layout existed keeps its
photos inline in the cloud copy; the app **migrates it automatically** on open,
filing them out once in the background.

## Self-healing

Because the file names are deterministic, the layout **repairs itself**. When
the app opens a folder or cloud copy it scans the `photos/` tree and, for any
image the document doesn't reference, reads the contact and photo id back out of
the file name and re-attaches it:

- A photo whose reference went missing — but whose file is still on the drive —
  is **found and re-indexed** onto its contact on the next open.
- You can **drop an image into `photos/` yourself** and have it adopted — name it
  `photos/<any-name>-<contactId>-<photoId>.jpg` (add `-source.jpg` for a
  re-croppable original). Only the contact id has to match a real card.

Trigger it on demand from **Settings → Developer → Photos → Reindex photos**,
which reports how many it reconnected. This applies to the **plaintext** copy
only; with encryption on, photos stay inside the encrypted envelope.
