---
type: Fixed
title: Correct per-channel PWA install identity
---

Installing the PWA from the `/preview/` (or a per-branch) deploy now installs
that channel's app instead of the root app — the manifest no longer pins an
origin-relative `id` that collapsed every channel to the same identity.
