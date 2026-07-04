---
type: Added
title: Spinners on connect, update, and backup actions so you can see them working
---

Actions that reach out to the network, the browser, or your storage now show a
spinner while they run, instead of a button that looks like nothing happened.

- **Connect** to Dropbox, Google Drive, or a local folder (and **Reconnect
  folder**) spins while the sign-in redirect, consent popup, or folder picker is
  in flight, and the button locks so a second tap can't stack another attempt.
- Tapping **Update** on the "a new version is ready" prompt swaps the toast for
  an **Updating…** spinner while the new version takes over and the page
  reloads.
- The **Back up now**, backup **download**, and backups-list **loading**
  indicators now actually spin.

**Check for updates** already spun while it worked — the rest of the app's
async actions now match it.
