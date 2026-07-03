---
type: Added
title: Migrate inline cloud photos to image files automatically on open
---

A document that was synced before contact photos were filed out into image
files keeps those photos embedded in the cloud copy. The app now **migrates it
on its own**: when it opens and finds a cloud copy that still holds inline
photos, it files them out once in the background — you no longer have to make an
edit or hit **Save now** to move your pictures out of the document. The sweep
runs at most once per connection, is skipped for encrypted cloud copies (which
keep photos in the encrypted envelope by design), and leaves an already-filed
document untouched.
