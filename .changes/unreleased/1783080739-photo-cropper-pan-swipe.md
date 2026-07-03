---
type: Fixed
title: Panning a photo in the cropper no longer drags the whole modal
doc: contacts
---

Dragging to pan (or pinching to zoom) inside the circle cropper no longer moves
the entire dialog. The cropper sits in a modal that closes on a downward swipe,
and a vertical pan was being read as that swipe, so the whole card slid with the
photo. Touch gestures inside the viewport now stay with the crop and never reach
the modal's swipe-to-close.
