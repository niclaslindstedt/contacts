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

## The photo atlas

Reading those files back one at a time is what makes opening a big address book
on a new device slow — and it's the burst of requests a drive answers by
throttling. So on **Dropbox and Google Drive** the app keeps a **photo atlas**
beside them: every contact's picture, shrunk to the size an avatar is actually
drawn at, bundled into a few `.zip` packs under `photos/atlas/`. A fresh device
reads those few packs instead of hundreds of image files, and the faces are
simply there.

The atlas carries only what's needed to _draw_ a contact. The full-size
originals stay exactly where they were, one previewable JPEG each, and are
fetched **only when you want one** — when you tap a photo to see it full-screen,
or re-open the cropper to re-frame it. So the first tap on a new device takes a
moment while the original arrives: the picture is already on screen at avatar
quality and sharpens when it lands. Offline, you keep the avatar-sized copy.

It's a convenience copy and never the only copy — every picture in it is also
filed at full resolution — so a pack that can't be written or read costs a
little speed and nothing else. The **local folder** backend has no atlas at all:
a folder on your own disk has no rate limit, and a browsable tree of real image
files is the whole point of it.

## When the drive is busy

A big address book means a lot of image files, and a drive will push back if the
app asks for them all at once — Dropbox starts answering "too many requests", and
the browser itself begins refusing connections. So photos move **a few files at a
time**, and when a drive asks the app to slow down it waits as long as it was
asked and tries again before giving up on a picture.

While that's happening your photos stay put. A picture the app couldn't upload
**keeps the copy already on the drive** — clean-up of unused files is skipped
entirely for a save that didn't get everything through, so a busy moment can
never delete a photo it merely failed to replace. And a picture the app couldn't
download **stays on this device**: when a drive copy is taken on, photos already
here are carried across rather than replaced with blanks. A photo you genuinely
delete or re-crop somewhere else still wins.

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
