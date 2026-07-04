---
type: Fixed
title: Border width and corner radius now apply, plus new dialog backdrop controls
---

The **Border width** and **Corner radius** appearance knobs now take effect
across the app. Single-width borders were pinned at 1px and the cards behind
DETAILS / addresses / notes used a fixed corner, so both settings looked dead —
they are now routed through the theme engine's variables, so thin / normal /
bold borders and the corner-radius steps reshape the whole UI.

Appearance also gains two new **Dialogs** controls:

- **Backdrop dimming** — how far the page behind an open dialog is darkened,
  from none through to dark (the previous look was the middle setting).
- **Backdrop blur** — how far the page behind a dialog is blurred, off by
  default.

Both preview live: adjust either and the open Settings dialog dims and blurs
against itself. (The roundness of checkboxes and toggles is governed by the
separate **Checkboxes** control-style knob — Square / Rounded / Circle.)
