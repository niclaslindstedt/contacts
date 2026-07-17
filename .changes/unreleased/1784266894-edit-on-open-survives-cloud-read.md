---
type: Fixed
title: Edits made on open sync cleanly
---

Editing a contact the moment you open the app with a cloud backend no longer risks a spurious "sync conflict" (and losing that edit if you reload to clear it) — the first save now waits for the initial backend read to finish before pushing, instead of racing it on a slow connection.
