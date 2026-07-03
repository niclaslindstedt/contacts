# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Released sections below are **generated at release time from the changeset
fragments** in `.changes/unreleased/` — add a fragment per user-visible change
(see `scripts/release/`), and the Release workflow collates them into a dated
section here. Do not hand-edit the released sections.

## [Unreleased]

## [0.3.0] - 2026-07-03

### Added

- **Developer "Fake data" mode and a seeded dev server** — Developer mode now has a **Fake data** toggle that swaps your address book for a throwaway sample full of varied edge-case contacts (nameless cards, very long and unicode text, many phones and emails, leap-day birthdays, archived cards and folders). It's an in-memory storage backend that takes over storage — nothing is saved, and reloading the page restores your real contacts. The dev server is seeded with this data by default via the new `VITE_SEED` build variable.
- **Position, zoom, and view contact photos** — Uploading a contact photo now opens a Facebook-style circle cropper — drag to
  move and pinch, scroll, or drag the slider to zoom, choosing exactly which part
  the circle shows. Tapping the photo in read mode opens it full-screen, and an
  adjust button re-frames it later. The upload, adjust, and remove actions live as
  glyphs in a Photo section above colour. On a connected cloud drive each original
  is filed at a tidy `photos/<name>-<id>.jpg` path so it's easy to find. [Learn more](feature:contacts)

### Changed

- **Refreshed the app icon and favicon** — The app mark is now a clean person outline drawn as a blue gradient stroke on
  the dark surface — the same line-art style as the sibling notes and checklist
  apps, in a distinct hue so Contacts stands apart in the tab bar and home
  screen. The browser-tab favicon, the PWA install icons, the Apple touch icon,
  and the social-preview image are all regenerated from the new mark.
- **Auto-capitalise words when typing a contact name** — Editing a contact's name now hints the on-screen keyboard to capitalise each
  word, so names come out as proper nouns (John Smith) without reaching for the
  shift key on every word.
- **The update prompt names the full version instead of a bare commit hash** — The "a new version is ready" prompt now shows the full build identifier
  (e.g. `1.3.0.237-pre+4f23a97`) — the same label the About dropdown shows —
  instead of just the short commit sha, so the incoming build is easy to
  recognise at a glance.
- **Format settings are now country-based** — The **Format** tab is now organised around a country. Pick your country
  (Sweden or the United States to start) and phone numbers and postal codes are
  shown that country's way — Sweden's `+46 (0)76-818 13 37` and `123 45`, the
  US's `+1 (202) 555-0100` and `12345-6789`. A number that carries its own
  country code (`+1`, `+46`) is formatted for that country automatically, so a
  Swedish address book still shows a US number the American way.

  Small toggles fine-tune the details without changing country: whether to
  format at all, whether to show the international country code, whether to show
  the leading-zero trunk digit, and whether to group postal codes with spaces.
  Each country decides what those toggles mean and ignores the ones it has no use
  for. Adding more countries is now a matter of dropping in one file per country,
  so the list will grow. As before, formatting changes the display only — what
  you typed is stored untouched.

### Fixed

- **Stop the preview/branch PWA from precaching a missing CNAME** — The `/preview/` and `/branch/` builds no longer list the GitHub Pages `CNAME`
  file in their service-worker precache. That file is stripped from every
  non-root deploy slot, so precaching it made the worker's install fetch 404 and
  threw off the byte total shown by the update-progress fill. It is excluded from
  the precache on every channel now.
- **The app updates without getting stuck on a stale cached build** — The service worker now fetches the app shell network-first (falling back to the
  cached copy only when offline), so a freshly-deployed build loads on the next
  reload instead of a normal browser tab staying pinned to the old cached version
  until the cache was cleared.
- **Birthday field no longer overflows its card on iOS** — On iOS the birthday date field in a contact's edit view stretched past the edge of its card, out of line with the other detail fields. The native date control now respects its layout box, so the field fits neatly like the rest.
- **Panning a photo in the cropper no longer drags the whole modal** — Dragging to pan (or pinching to zoom) inside the circle cropper no longer moves
  the entire dialog. The cropper sits in a modal that closes on a downward swipe,
  and a vertical pan was being read as that swipe, so the whole card slid with the
  photo. Touch gestures inside the viewport now stay with the crop and never reach
  the modal's swipe-to-close. [Learn more](feature:contacts)

## [0.2.0] - 2026-07-03

### Added

- **Read mode for contact cards** — A contact now opens in a read mode built for scanning: the avatar and name lead
  the card, phone numbers and emails become tap-to-call and tap-to-email rows, and
  the company, birthday, address, and notes render as plain, legible text — only
  the parts a card actually carries are shown. The pencil in the toolbar flips the
  card into edit mode (the check flips it back); a brand-new contact opens straight
  in edit mode so there is something to fill in.
- **Birthday countdown and age** — The birthday row now shows how long until the next one — a "Today", "Tomorrow",
  or "in N days" chip — and tapping the row reveals the contact's current age. [Learn more](feature:contacts)
- **Add a birthday to your calendar** — Tapping the birthday countdown chip now downloads an all-day calendar event for
  that contact's birthday, recurring every year, ready for your calendar app to
  open and add. [Learn more](feature:contacts)
- **Add a Format settings tab** — Settings now has a **Format** tab for choosing how value-shaped fields are
  displayed: a date format for birthdays (ISO, US, European, or a long "3 July
  2026" form), a phone number format (as entered, international, national, or
  compact E.164), and a postal-code format (as entered, US 5-digit, US ZIP+4, or
  a grouped "123 45" style). Each picker previews the current choice with a live
  sample. Saved phone numbers render in the chosen format on the card and reveal
  exactly what you typed when you focus the field to edit it — the stored value is
  never rewritten, so switching formats reformats every card without touching your
  data.

### Changed

- **Refine the contact card form** — The contact card's icon picker now offers marks that fit an address book —
  relations (partner, family, friend, favourite) and the kinds of places you save
  (work, bank, doctor, school, shop, café, gym, travel). The details section no
  longer repeats first and last name (the card is named from its header), the
  address field is taller by default, and the birthday field and the card body no
  longer spill sideways on a narrow screen.
- **Show the full build label in the About dropdown** — The "Source code" row in the About dropdown now shows the full build
  identifier — `<version>[.<run>][-<slot>][+<commit>]`, e.g.
  `0.1.0.237-pre+4f23a97` — instead of just the bare version. Preview builds are
  tagged `-pre` and per-branch builds `-br`, and the short commit hash is
  appended as build metadata, so you can tell at a glance exactly which build is
  running. Local builds still collapse to the bare version.
- **Structured postal address with tap-to-map** — A contact's address is now three fields — street, postal code, and city —
  instead of one free-form box, so it reads as a proper address and exports into
  the right vCard and CSV columns. In read mode the address is a link: tapping it
  opens the address in your maps app. Existing free-form addresses are split into
  the new fields on upgrade. [Learn more](feature:contacts)

### Fixed

- **Correct per-channel PWA install identity** — Installing the PWA from the `/preview/` (or `/branch/`) deploy now installs
  that channel's own app instead of the root app. The web manifest is generated
  per build with an absolute, channel-specific `id`/`start_url`/`scope` and a
  distinct tile name, so channels no longer collapse onto the root identity in
  engines (such as iOS Safari) that resolve those members against the origin.

## [0.1.0]

- Contact cards with names, phone numbers, emails, company, address, birthday, notes, and photos. [Learn more](feature:contacts)
- Folders and drag-and-drop organisation in the side menu, with archive and undo/redo.
- Namespaces — separate address books you can switch between and move contacts across. [Learn more](feature:namespaces)
- Cloud sync to Dropbox or Google Drive, with optional AES-GCM encryption of the cloud copy. [Learn more](feature:sync)
- Export as vCard (.vcf) for Outlook, iOS, and Android, as Outlook-compatible CSV, and as a JSON backup. [Learn more](feature:export)
- Themes, achievements, full-text search, English/Swedish UI, and an installable offline PWA shell.
