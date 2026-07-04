---
type: Added
title: Standalone privacy policy and about pages
---

Two no-login static pages now ship with the app:

- **`/privacy`** — an English-only **privacy policy** that spells out exactly
  what the app stores, where, and when (if ever) anything leaves your device:
  local-first by default, with optional Dropbox / Google Drive sync and
  encryption covered in full.
- **`/home`** — a showcase **about page** that identifies the app, describes
  what it does, and explains — transparently — why it asks for Google Drive or
  Dropbox access only when you turn on optional cloud sync. This is the page
  linked as the app homepage on the cloud providers' OAuth consent screens.

Both render the same installable PWA shell (mounted by pathname), carry their
own page title, description, and social-card metadata, and are listed in the
sitemap.
