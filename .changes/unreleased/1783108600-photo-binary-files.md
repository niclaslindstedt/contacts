---
type: Changed
title: Store cloud photos as binary JPEG files, kept out of the document
---

On a cloud drive (Dropbox or Google Drive), contact pictures are now written as
genuine **binary JPEG files** you can preview in the drive, instead of base64
text. Both the display crop and the larger original are filed out
(`photos/<name>-<id>.jpg` and `…-source.jpg`), so the synced document carries no
image bytes at all and stays small. Photos that arrive on an **imported vCard**
are broken out into files the same way rather than riding inline in the
document. Nothing changes for the copy on this device — it still keeps photos
inline so the app renders offline — and encrypted cloud copies still keep photos
inside the encrypted envelope.
