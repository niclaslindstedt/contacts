---
type: Added
title: Keep several photos per contact and swap between them
---

A contact can now hold **more than one photo** and switch which one is shown
whenever you like — no more deleting and re-uploading to get an old picture back.

In edit mode, the avatar popover's **Photos** section shows a thumbnail for each
picture (the current face ringed with a check), a **＋** tile to add another, and
**Adjust** / **Remove** for the current one. Tap any thumbnail to make it the
face. Dropping an image onto the card adds it to the gallery too, rather than
replacing what's there.

In read mode, tapping the photo opens it full-screen; when there are several,
**swipe left and right** (or use the arrow keys) to page through them, with a
count readout and a dot per photo so you can see how many there are.

Only the **current face** is written to a downloaded or copied vCard. On a
connected cloud drive every photo is filed out to its own binary JPEG at
`photos/<name>-<id>-<photoId>.jpg`, so the synced document stays free of image
data. Existing single-photo cards upgrade automatically into a one-photo gallery.
