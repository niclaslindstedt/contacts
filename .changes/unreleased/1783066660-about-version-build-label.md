---
type: Changed
title: Show the full build label in the About dropdown
---

The "Source code" row in the About dropdown now shows the full build
identifier — `<version>[.<run>][-<slot>][+<commit>]`, e.g.
`0.1.0.237-pre+4f23a97` — instead of just the bare version. Preview builds are
tagged `-pre` and per-branch builds `-br`, and the short commit hash is
appended as build metadata, so you can tell at a glance exactly which build is
running. Local builds still collapse to the bare version.
