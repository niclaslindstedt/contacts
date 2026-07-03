---
type: Fixed
title: Stop the preview/branch PWA from precaching a missing CNAME
---

The `/preview/` and `/branch/` builds no longer list the GitHub Pages `CNAME`
file in their service-worker precache. That file is stripped from every
non-root deploy slot, so precaching it made the worker's install fetch 404 and
threw off the byte total shown by the update-progress fill. It is excluded from
the precache on every channel now.
