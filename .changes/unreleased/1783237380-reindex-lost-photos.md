---
type: Added
title: Find lost photos and adopt photos dropped into the drive
---

Contact photos are filed to the drive under **deterministic names** built from
the contact and photo ids, and the app now reads those names back the next time
it opens a folder or cloud copy. Any photo file the document doesn't already
reference is re-attached to the contact its name points at — so the photo layout
is **self-healing**:

- A photo whose reference went missing from the document — but whose file is
  still on the drive — is **found and re-indexed** back onto its contact on the
  next open, instead of lingering as a stray file (or being pruned away).
- You can **drop an image into the `photos/` folder yourself** and have it
  adopted. Name it `photos/<any-readable-name>-<contactId>-<photoId>.jpg` (add
  `-source.jpg` for a re-croppable original) — the easiest way is to copy an
  existing photo file's name and change the photo id. Only the contact id has to
  match a real card; the leading name is cosmetic.

This applies to the plaintext folder and cloud backends; encrypted copies keep
photos inside the encrypted envelope as before.
