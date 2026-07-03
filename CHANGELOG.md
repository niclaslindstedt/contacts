# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Released sections below are **generated at release time from the changeset
fragments** in `.changes/unreleased/` — add a fragment per user-visible change
(see `scripts/release/`), and the Release workflow collates them into a dated
section here. Do not hand-edit the released sections.

## [Unreleased]

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
