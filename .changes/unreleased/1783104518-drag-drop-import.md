---
type: Added
title: Import contacts by drag-and-drop or file picker
---

You can now **bring contacts in**, not just out. Drag a file straight onto the
contact screen — a dashed overlay confirms the drop — and its cards are read and
filed into your address book. This makes it a one-gesture move to drop a `.vcf`
shared out of the iOS/Android Contacts app right into the app. Prefer a button?
**Settings → Storage → Import** opens a file picker for the same thing, and
several files can come in at once.

Three formats are understood, mirroring the export side: **vCard (`.vcf`)** from
iOS/Android/Outlook (names, company, typed phones and emails, addresses, the
birthday, Apple grouped important dates, notes, and an embedded photo — folded
and quoted-printable lines included), an Outlook-style **CSV**, and the app's own
**JSON backup** (upgraded through the migration pipeline, archived cards
skipped). Imported cards are always added — never merged over what you already
have — land at the root, and arrive as a single undo step, so one Undo reverses a
whole import.
