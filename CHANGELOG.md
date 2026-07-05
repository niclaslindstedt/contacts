# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Released sections below are **generated at release time from the changeset
fragments** in `.changes/unreleased/` — add a fragment per user-visible change
(see `CLAUDE.md` → "Changelog and feature docs"), and the Release workflow
collates them into a dated section here. Each bullet is a bold title and a
single sentence; a big feature carries a **Learn more** link to its feature
doc. Do not hand-edit the released sections.

## [Unreleased]

## [0.4.0] - 2026-07-04

### Added

- **Private/work types, titled addresses, and important dates** — Every phone number and email now carries a Private or Work type, a card can hold several titled postal addresses, and you can add name days, anniversaries, and other important dates beside the birthday. [Learn more](feature:contacts)
- **Import contacts** — Bring cards in by dropping a `.vcf`, CSV, or JSON file onto the screen or picking one from Settings → Storage. [Learn more](feature:export)
- **Set a photo by dragging an image onto the card** — Drag a picture straight onto an open contact and the circle cropper opens to frame it — no edit mode needed.
- **Several photos per contact** — A card can hold more than one photo and swap which one is shown, paging through them full-screen with a swipe. [Learn more](feature:contacts)
- **Auto-archive on a date you choose** — A contact can file itself away — archived or deleted — on a date you set, handy for a place you only need for a while. [Learn more](feature:contacts)
- **List overview with multi-select** — A new List view lays every contact out grouped by folder, with a Select mode to copy or export a batch of cards at once. [Learn more](feature:contacts)
- **Compact or spacious list rows** — A List setting sizes the rows — Compact to fit more contacts, Spacious for a larger photo — and sits the numbers beside the name on a wide screen.
- **Prefer Private or Work numbers in the List** — A List setting shows each contact's Private number, their Work number, or both, tagging each with its type when more than one shows.
- **Back button from a card opened in the List** — A contact opened from the List page shows a back button in its header that returns you to the list where you left off.
- **Migrate inline cloud photos automatically** — A cloud copy that still embeds contact photos has them filed out into image files on its own the next time you open the app.
- **Configurable Donate link** — The side menu's Donate target can be set at build time with `VITE_DONATE_URL`, falling back to the project's GitHub Sponsors page.

### Changed

- **Choose which copy wins when connecting a cloud drive** — Connecting a Dropbox or Google Drive that already holds contacts now asks which copy to keep instead of silently overwriting. [Learn more](feature:sync)
- **Store cloud photos as binary JPEG files** — Contact pictures on a cloud drive are now written as real, previewable JPEG files kept out of the document, rather than base64 text inside it. [Learn more](feature:sync)
- **Hide cloud backends that aren't configured** — The storage picker now lists a cloud provider only when its OAuth key is baked into the build, instead of showing it with a "key missing" warning.
- **Important dates require an occasion** — The occasion is now required, since it names the countdown chip and the calendar reminder.
- **Cleaner List header** — The List view's top bar drops the running contact count and turns the text Select button into a glyph badge that matches the selection toolbar.
- **Clearer List selection** — Select all is now its own checkbox row below the count, long contact names wrap instead of truncating, and empty folders no longer appear.

### Fixed

- **App-mark favicon instead of a folder glyph** — The browser tab now shows the app's own person mark by default, and the build emits a multi-resolution `favicon.ico` for engines that don't render SVG favicons.

## [0.3.0] - 2026-07-03

### Added

- **Position, zoom, and view contact photos** — Uploading a photo opens a circle cropper to frame it, and tapping it in read mode opens it full-screen. [Learn more](feature:contacts)
- **Developer "Fake data" mode and a seeded dev server** — A Developer toggle swaps your address book for a throwaway sample of edge-case contacts (nothing is saved), and the dev server seeds it by default via `VITE_SEED`.

### Changed

- **Country-based format settings** — The Format tab is now organised around a country: pick Sweden or the United States and phone numbers and postal codes are shown that country's way. [Learn more](feature:formats)
- **Refreshed app icon and favicon** — The app mark is now a person outline in a distinct blue, regenerated across the favicon, PWA install icons, Apple touch icon, and social image.
- **Auto-capitalise contact names** — Editing a name hints the keyboard to capitalise each word, so names come out as proper nouns without reaching for shift.
- **Update prompt names the full version** — The "new version is ready" prompt now shows the full build identifier instead of a bare commit hash.

### Fixed

- **App updates without sticking on a stale build** — The service worker fetches the app shell network-first, so a freshly deployed build loads on the next reload instead of staying pinned to the cached copy.
- **Preview/branch PWA no longer precaches a missing CNAME** — The non-root deploy slots drop the stripped `CNAME` from their service-worker precache, so the worker's install no longer 404s.
- **Birthday field no longer overflows its card on iOS** — The native date control now respects its layout box, so the edit-mode birthday field fits like the rest.
- **Panning a photo no longer drags the whole cropper modal** — Touch gestures inside the crop viewport stay with the photo instead of triggering the modal's swipe-to-close.

## [0.2.0] - 2026-07-03

### Added

- **Read mode for contact cards** — A contact opens laid out to be read — tap-to-call and tap-to-email rows and plain, legible details — with a pencil to flip into edit mode. [Learn more](feature:contacts)
- **Format settings tab** — A new Format tab chooses how birthdays, phone numbers, and postal codes are displayed, previewing each choice with a live sample and never rewriting what you typed. [Learn more](feature:formats)
- **Birthday countdown and age** — The birthday row shows how long until the next one, and tapping it reveals the contact's current age.
- **Add a birthday to your calendar** — Tapping the birthday countdown chip downloads a yearly all-day calendar event for that contact.

### Changed

- **Structured postal address with tap-to-map** — An address is now street, postal code, and city fields that export into the right columns and open in your maps app when tapped. [Learn more](feature:contacts)
- **Refine the contact card form** — The icon picker now offers address-book marks, the details section drops the duplicated name fields, and the card no longer spills sideways on a narrow screen.
- **Show the full build label in About** — The About dropdown's "Source code" row shows the full build identifier — version, run, slot, and commit — instead of the bare version.

### Fixed

- **Correct per-channel PWA install identity** — Installing from a `/preview/` or `/branch/` slot now installs that channel's own app, with a channel-specific manifest id and name.

## [0.1.0]

- Contact cards with names, phone numbers, emails, company, address, birthday, notes, and photos. [Learn more](feature:contacts)
- Folders and drag-and-drop organisation in the side menu, with archive and undo/redo.
- Namespaces — separate address books you can switch between and move contacts across. [Learn more](feature:namespaces)
- Cloud sync to Dropbox or Google Drive, with optional AES-GCM encryption of the cloud copy. [Learn more](feature:sync)
- Export as vCard (.vcf) for Outlook, iOS, and Android, as Outlook-compatible CSV, and as a JSON backup. [Learn more](feature:export)
- Themes, achievements, full-text search, English/Swedish UI, and an installable offline PWA shell.
</content>
</invoke>
