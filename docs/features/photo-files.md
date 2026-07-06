# Cloud photo files

On a folder or cloud backend (local folder, Dropbox, or Google Drive), each
photo in a contact's gallery is filed out of the document into its own **binary
JPEG** — a display crop at `photos/<name>-<tag>-<number>.jpg` and the larger
original beside it — instead of riding along as base64 text. The name is the
contact's name, a short tag that keeps two people who share a name apart, and
the photo's position in the gallery, so the **first photo ends `-1.jpg`**, the
next `-2.jpg`, and so on — predictable enough to find by hand. They're real
image files you can preview in the drive, and because every image byte moves out
to a file, the synced document carries no picture data at all and stays small.
Photos that arrive on an imported vCard are broken out the same way on the next
save.

The copy on **this device** keeps its photos close by — inline when they fit,
and in a roomier on-device store when there are too many for that — so a cold
restart shows them **immediately, online or off**, without waiting to re-fetch
them from the drive. A document synced before this layout existed, or one filed
under an older name, is **brought up to date automatically** on open: its photos
are filed out (or renamed) once in the background, and any file left behind under
the old name removed.

## Self-healing

Because the file names are deterministic, the layout **repairs itself**. When
the app opens a folder or cloud copy it scans the `photos/` tree and, for any
image the document doesn't reference, reads the contact and photo id back out of
the file name and re-attaches it:

- A photo whose reference went missing — but whose file is still on the drive —
  is **found and re-indexed** onto its contact on the next open, matched by the
  name's tag and number.

Trigger it on demand from **Settings → Developer → Photos → Reindex photos**,
which reports how many it reconnected. This applies to the **plaintext** copy
only; with encryption on, photos stay inside the encrypted envelope.
