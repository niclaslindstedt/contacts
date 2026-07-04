---
type: Fixed
title: Stop app updates from wiping the on-device contacts copy
---

Updating the app could leave the on-device copy of your contacts empty until you
reconnected your cloud storage and pulled the copy back down. The cause was a
non-obvious data-loss path: when a freshly updated build hadn't fully taken over
yet, the still-running older build would read a document the newer build had
already upgraded, fail to make sense of it, and fall back to a blank starter —
which then got written straight back over the only local copy.

The device copy is now handled **non-destructively**:

- A stored document this build can't read (for example, one a newer build
  already upgraded) is **left on disk untouched** instead of being replaced with
  a blank one, so it reappears on its own once the update settles. A copy is also
  quarantined for recovery, and the failure is logged to the **Logs** settings
  tab rather than passing silently.
- Loading a document never writes it straight back, so a momentary read failure
  can't overwrite good data.
- When the device's storage is full, the app now keeps **every contact** by
  saving a slimmed copy without the cached photo/attachment bytes (which a
  connected cloud copy re-hydrates), instead of failing the whole save.

Your contacts in the cloud were never affected — this only concerns the copy
kept on the device.
