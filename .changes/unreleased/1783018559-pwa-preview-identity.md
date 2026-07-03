---
type: Fixed
title: Correct per-channel PWA install identity
---

Installing the PWA from the `/preview/` (or `/branch/`) deploy now installs
that channel's own app instead of the root app. The web manifest is generated
per build with an absolute, channel-specific `id`/`start_url`/`scope` and a
distinct tile name, so channels no longer collapse onto the root identity in
engines (such as iOS Safari) that resolve those members against the origin.
