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

## [0.5.0] - 2026-07-05

### Added

- **Emergency contacts pinned to the top** — Flag a person as **in case of emergency** from a switch in its edit view and it's pinned to a dedicated section at the top of the side menu, badged with a siren wherever it appears and kept in the JSON backup.
- **Favorites** — Star the contacts you reach for most with the heart on a card or list row, and they gather on their own Favorites page beside List in the sidebar's action grid. [Learn more](feature:favorites)
- **Open in Dropbox / Google Drive** — The Sync command centre gained an Open in {provider} button that jumps to the drive's own web UI, straight onto your synced files.
- **Reorder favorites by dragging** — The Favorites page is a hand-orderable shortlist — drag a row by its grip handle to set the order, with an insertion line showing where it will land.
- **Configurable cloud app-folder names** — The Dropbox and Google Drive folder names are now settable at build time via `VITE_DROPBOX_APP_FOLDER` and `VITE_GDRIVE_APP_FOLDER`, defaulting to `Contacts`.
- **Website field and company cards** — Cards gained a Website field (exported as the vCard `URL`) and a Company contact switch that names the card by a single organisation, hides the person-only fields, and exports it as a company.
- **Attach files to a contact** — Clip files to a contact — images show as tap-to-expand thumbnails, other files as rows — kept in the JSON backup and filed out as real files on a connected drive. [Learn more](feature:attachments)
- **Privacy policy and about pages** — Two no-login pages ship with the app — a `/privacy` policy spelling out what's stored and when it leaves your device, and a `/home` showcase page linked from the cloud providers' consent screens.
- **Sort folders alphabetically or by hand** — Folders gained a sort order under Settings → General → Folders — keep them in name order, or arrange them yourself by dragging one onto another in the sidebar.
- **Collapse or expand every folder** — The Contacts header carries a folder glyph that folds every folder shut in one click, then expands them all again.
- **Sync to a local folder** — A new Local folder backend syncs your address book to a directory you pick on this computer — no account, no network — with photos and attachments filed beside the document as real files. [Learn more](feature:local-folder)
- **Fold the side-menu footer away** — A chevron rail above the side-menu footer folds the Donate, trophy, About, and Settings rows away, handing their space to the contact list.
- **Dated backups** — Take timestamped `.zip` snapshots of your whole address book from Settings → Storage → Backups — download, restore, or browse them on a connected drive. [Learn more](feature:backups)
- **Nest folders into subfolders** — Folders now nest to any depth — drag one onto another to nest it, and archiving, deleting, or moving a folder carries its whole subtree along. [Learn more](feature:subfolders)
- **Spinners on connect, update, and backup** — Connecting a backend, applying an update, and taking a backup now show a spinner while they run instead of a button that looks inert.
- **Find lost photos and adopt dropped ones** — The app re-reads the drive's deterministically-named photo files on open, re-attaching any the document lost and adopting images you drop into the `photos/` folder yourself. [Learn more](feature:photo-files)
- **Organise contacts from the List page** — Drag a contact row onto a folder to file it there, multi-select to move a batch at once, or use the new Move to folder right-click action. [Learn more](feature:list)
- **Reindex photos button** — Settings → Developer → Photos gained a Reindex photos button that rescans the drive and reconnects any unlinked photo file on demand.
- **A searchable country picker with thirty developed countries** — Pick your country for phone and postal formatting from a type-ahead list of the thirty most developed countries — each with its flag, its own grouping rules, and defaulting to Sweden. [Learn more](feature:formats)
- **Swipe and right-click actions on the List and Favorites rows** — List and Favorites rows now carry the side menu's row gestures — swipe left to delete, swipe right to archive, and a desktop right-click menu with Move to folder, Archive, and Delete. [Learn more](feature:list)
- **Primary phone number** — Mark one of a contact's numbers as their primary and the Favorites page shows just that number instead of the whole list. [Learn more](feature:favorites)

### Changed

- **Archive button in the action-grid corner** — The Archive button moved to the lower-right corner of the side-menu action grid, so the bottom row now reads Undo · Redo · Search · Archive.
- **Matching collapse / expand glyph in the sidebar** — The side menu's collapse-all / expand-all button now wears the same fold/unfold chevron mark as the list page's, so the affordance reads identically in both places.
- **Formatting on by default** — Phone numbers and postal codes now render in your country's convention out of the box, with a Format-tab toggle to show them exactly as typed instead.
- **Editing stays on when you switch contacts** — Opening another contact while editing now keeps you in edit mode and saves the card you were on first, so an in-progress edit isn't lost.
- **Cleaner Work / Private toggle** — Each phone and email's type is now a compact two-glyph toggle — a person for Private, a briefcase for Work — that flips without the field losing focus.
- **Redesigned cloud-setup prompt** — The prompt for choosing which copy to keep when connecting a cloud drive is now a compact centred dialog, each choice a full-width button carrying its contact and folder counts.
- **Open on the List page** — The app now opens on the List overview of your whole address book instead of a single card, with a back button once you open a contact.
- **Phone numbers as Private / Work pills** — Phone numbers on the List and Favorites pages now read as pills led by a type glyph — a person for Private, a briefcase for Work — so the two are easy to tell apart.
- **Clearer contact edit view** — The edit view got a polish pass — glyph section titles, plainer switch labels, auto-archive moved to the bottom, and shorter option hints.
- **Drop the test-log button** — The Developer tab's throwaway "Write a test log line" button is gone, leaving just the Capture logs toggle.
- **Easier folder reordering** — The drop-between zone when dragging a folder now covers the top and bottom 40% of a row, so a folder slots above or below a sibling instead of accidentally nesting inside it.
- **List folder sections as separators** — A folder's heading on the List page is now a tinted separator band with an uppercase label and count, plus a collapse / expand all button next to Select.
- **Density shapes the whole chrome** — The Appearance → Density knob now tightens the settings cards, side menu, and action island too, not just the contact list.
- **Tap anywhere on a list row to open it** — The whole contact row now opens the card when tapped, not just its avatar and name — only the phone, email, and favorite controls act on their own.
- **Roomier phone pill on spacious rows** — A spacious list row with a single phone number now shows a larger pill set lower beneath the name, so it fills the taller photo's height instead of leaving dead space.
- **Select controls in the List's top menu** — Select mode's copy, export, and collapse actions now sit in the List header's top menu beside a highlighted Select toggle you tap to leave, Select all moves to a checkbox row at the top of the contacts, and the copy and export buttons stay disabled until you tick a contact. [Learn more](feature:contacts)
- **Phone numbers stored as clean digits** — Phone numbers now keep just their national digits with the country code on a separate dropdown that defaults to your home country, and existing numbers are converted automatically. [Learn more](feature:contact-cards)
- **Contacts open in a swipe-to-dismiss card** — Tapping a contact on the List or Favorites page now opens it in a card that floats over the page and slides away with a swipe down, so the back button is gone — picking a contact from the sidebar still opens the full page.
- **Roomier phone rows on mobile** — The phone country picker now shows just the flag on mobile so the number field gets more room, while the calling code stays visible on wider screens and in the open dropdown.
- **Compact private/work toggle** — The private/work picker on phone and email rows is now a single tap-to-switch button, and the row's icon controls are tighter, leaving more room for the value.

### Fixed

- **Switches no longer jump the page** — Flipping a switch near the bottom of a card's edit view no longer yanks the card off-screen on desktop.
- **Symmetric Donate heart** — The Donate link now wears the same clean, symmetric heart the app draws for favorites.
- **Hover states on list rows** — Contact rows on the List, Favorites, and Archive pages now highlight on hover and show the pointer cursor, matching the side menu.
- **Working border, radius, and dialog backdrop controls** — The Border width and Corner radius knobs now reshape the whole UI, and Appearance gains dialog backdrop dimming and blur controls that preview live.
- **Updates no longer wipe the on-device copy** — An app update can no longer blank the on-device contacts copy — an unreadable stored document is now left untouched rather than overwritten with a blank one.
- **Bigger footer-collapse control** — The footer-collapse rail is now a taller tap target, and folding the footer reclaims its bottom inset for the contact list instead of leaving a gap.
- **No dead space under the footer and modal buttons** — The side-menu footer and modal button rows now sit snug against the bottom instead of floating above a redundant safe-area gap in the installed PWA.
- **What's new header clear of the notch** — The What's new dialog and its Learn more pages now carry the top safe-area inset, so their close button no longer hides under a notch.
- **Cleaner folder breaks in the List** — The last contact in a folder no longer draws a divider line straight into the next folder's header on the List page, so each group reads as an enclosed block.
  </content>

## [0.4.0] - 2026-07-04

### Added

- **Private/work types, titled addresses, and important dates** — Every phone number and email now carries a Private or Work type, a card can hold several titled postal addresses, and you can add name days, anniversaries, and other important dates beside the birthday. [Learn more](feature:contact-cards)
- **Import contacts** — Bring cards in by dropping a `.vcf`, CSV, or JSON file onto the screen or picking one from Settings → Storage. [Learn more](feature:import)
- **Set a photo by dragging an image onto the card** — Drag a picture straight onto an open contact and the circle cropper opens to frame it — no edit mode needed.
- **Several photos per contact** — A card can hold more than one photo and swap which one is shown, paging through them full-screen with a swipe. [Learn more](feature:photos)
- **Auto-archive on a date you choose** — A contact can file itself away — archived or deleted — on a date you set, handy for a place you only need for a while. [Learn more](feature:auto-archive)
- **List overview with multi-select** — A new List view lays every contact out grouped by folder, with a Select mode to copy or export a batch of cards at once. [Learn more](feature:list)
- **Compact or spacious list rows** — A List setting sizes the rows — Compact to fit more contacts, Spacious for a larger photo — and sits the numbers beside the name on a wide screen.
- **Prefer Private or Work numbers in the List** — A List setting shows each contact's Private number, their Work number, or both, tagging each with its type when more than one shows.
- **Back button from a card opened in the List** — A contact opened from the List page shows a back button in its header that returns you to the list where you left off.
- **Migrate inline cloud photos automatically** — A cloud copy that still embeds contact photos has them filed out into image files on its own the next time you open the app.
- **Configurable Donate link** — The side menu's Donate target can be set at build time with `VITE_DONATE_URL`, falling back to the project's GitHub Sponsors page.

### Changed

- **Choose which copy wins when connecting a cloud drive** — Connecting a Dropbox or Google Drive that already holds contacts now asks which copy to keep instead of silently overwriting. [Learn more](feature:cloud-sync)
- **Store cloud photos as binary JPEG files** — Contact pictures on a cloud drive are now written as real, previewable JPEG files kept out of the document, rather than base64 text inside it. [Learn more](feature:photo-files)
- **Hide cloud backends that aren't configured** — The storage picker now lists a cloud provider only when its OAuth key is baked into the build, instead of showing it with a "key missing" warning.
- **Important dates require an occasion** — The occasion is now required, since it names the countdown chip and the calendar reminder.
- **Cleaner List header** — The List view's top bar drops the running contact count and turns the text Select button into a glyph badge that matches the selection toolbar.
- **Clearer List selection** — Select all is now its own checkbox row below the count, long contact names wrap instead of truncating, and empty folders no longer appear.

### Fixed

- **App-mark favicon instead of a folder glyph** — The browser tab now shows the app's own person mark by default, and the build emits a multi-resolution `favicon.ico` for engines that don't render SVG favicons.

## [0.3.0] - 2026-07-03

### Added

- **Position, zoom, and view contact photos** — Uploading a photo opens a circle cropper to frame it, and tapping it in read mode opens it full-screen. [Learn more](feature:photos)
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

- **Read mode for contact cards** — A contact opens laid out to be read — tap-to-call and tap-to-email rows and plain, legible details — with a pencil to flip into edit mode. [Learn more](feature:contact-cards)
- **Format settings tab** — A new Format tab chooses how birthdays, phone numbers, and postal codes are displayed, previewing each choice with a live sample and never rewriting what you typed. [Learn more](feature:formats)
- **Birthday countdown and age** — The birthday row shows how long until the next one, and tapping it reveals the contact's current age.
- **Add a birthday to your calendar** — Tapping the birthday countdown chip downloads a yearly all-day calendar event for that contact.

### Changed

- **Structured postal address with tap-to-map** — An address is now street, postal code, and city fields that export into the right columns and open in your maps app when tapped. [Learn more](feature:addresses)
- **Refine the contact card form** — The icon picker now offers address-book marks, the details section drops the duplicated name fields, and the card no longer spills sideways on a narrow screen.
- **Show the full build label in About** — The About dropdown's "Source code" row shows the full build identifier — version, run, slot, and commit — instead of the bare version.

### Fixed

- **Correct per-channel PWA install identity** — Installing from a `/preview/` or `/branch/` slot now installs that channel's own app, with a channel-specific manifest id and name.

## [0.1.0]

- Contact cards with names, phone numbers, emails, company, address, birthday, notes, and photos. [Learn more](feature:contact-cards)
- Folders and drag-and-drop organisation in the side menu, with archive and undo/redo.
- Namespaces — separate address books you can switch between and move contacts across. [Learn more](feature:namespaces)
- Cloud sync to Dropbox or Google Drive, with optional AES-GCM encryption of the cloud copy. [Learn more](feature:cloud-sync)
- Export as vCard (.vcf) for Outlook, iOS, and Android, as Outlook-compatible CSV, and as a JSON backup. [Learn more](feature:export)
- Themes, achievements, full-text search, English/Swedish UI, and an installable offline PWA shell.
</content>
</invoke>
