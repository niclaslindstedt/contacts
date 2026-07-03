---
type: Fixed
title: The app updates without getting stuck on a stale cached build
---

The service worker now fetches the app shell network-first (falling back to the
cached copy only when offline), so a freshly-deployed build loads on the next
reload instead of a normal browser tab staying pinned to the old cached version
until the cache was cleared.
