---
type: Fixed
title: The browser tab shows the app mark instead of a folder glyph
---

The website tab showed a generic **folder** icon instead of the app's mark. Two
things caused it. The tab favicon is re-badged at runtime from the active
namespace or contact, and by default it fell back to the framework's generic
`folder` glyph; it now shows the app's own person mark by default (the same icon
the installed PWA wears), and only swaps to a contact's glyph when that contact
has a custom one. The site also only shipped an **SVG favicon**, so engines that
don't render SVG favicons (Safari, search-engine crawlers, the implicit
`/favicon.ico` request) had nothing to show; the build now also emits a
multi-resolution **`favicon.ico`** (16/32/48 px) from the same mark and links it
alongside the SVG. The `.ico` is base-correct per release channel and precached
with the rest of the shell.
