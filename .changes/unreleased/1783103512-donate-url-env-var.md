---
type: Added
title: Make the Donate link configurable at build time
---

The side menu's **Donate** link target can now be set at build time via the
`VITE_DONATE_URL` environment variable (wired up as a repository variable in
the deploy workflows), so the sponsorship page can change without a code edit.
When unset it falls back to the project's GitHub Sponsors page as before.
