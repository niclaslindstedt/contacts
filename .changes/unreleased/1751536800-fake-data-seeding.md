---
type: Added
title: Developer "Fake data" mode and a seeded dev server
---

Developer mode now has a **Fake data** toggle that swaps your address book for a throwaway sample full of varied edge-case contacts (nameless cards, very long and unicode text, many phones and emails, leap-day birthdays, archived cards and folders). It's an in-memory storage backend that takes over storage — nothing is saved, and reloading the page restores your real contacts. The dev server is seeded with this data by default via the new `VITE_SEED` build variable.
