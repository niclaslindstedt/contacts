# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Released sections below are **generated at release time from the changeset
fragments** in `.changes/unreleased/` — add a fragment per user-visible change
(see `scripts/release/`), and the Release workflow collates them into a dated
section here. Do not hand-edit the released sections.

## [Unreleased]

## [0.4.0] - 2026-07-04

### Added

- **Private/work types, multiple titled addresses, and important dates** — Contact cards gained three related pieces of structure. Every **phone number and
  email address now carries a type** — Private or Work — chosen from a small
  dropdown in edit mode and shown as the row's label in read mode. A card can hold
  **more than one postal address**, each with a free-text **title** (a home, a
  cabin, a workplace; the field defaults to the "Home" placeholder). And beyond the
  birthday you can add any number of **important dates** — a name day, an
  anniversary — each with a free-text occasion and a date that's either a full date
  or **day and month only** (leave the year blank). Like the birthday, each
  important date shows a countdown chip; tapping it hands a yearly reminder to your
  calendar, titled with the occasion and the contact's name (e.g. "Anniversary
  Sarah Connor"). Existing single addresses are carried forward automatically. On
  export, the types map onto the standard vCard `TEL`/`EMAIL`/`ADR` TYPEs and
  full-date important dates ride as grouped `X-ABDATE` items; the JSON backup keeps
  everything at full fidelity.
- **Make the Donate link configurable at build time** — The side menu's **Donate** link target can now be set at build time via the
  `VITE_DONATE_URL` environment variable (wired up as a repository variable in
  the deploy workflows), so the sponsorship page can change without a code edit.
  When unset it falls back to the project's GitHub Sponsors page as before.
- **Import contacts by drag-and-drop or file picker** — You can now **bring contacts in**, not just out. Drag a file straight onto the
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
- **Set a contact photo by dragging an image onto the card** — Give a contact a picture without hunting for the upload button: **drag an image
  straight onto the open contact** and a dashed drop zone confirms the target.
  Release, and the circle cropper opens so you can frame the shot before it lands
  — no need to be in edit mode or to open the appearance popover first.
  
  It slots in beside the drag-and-drop **import**: dropping a `.vcf`/CSV/JSON still
  files contacts into your address book, while an image is recognised as a photo
  for the contact you're looking at.
- **Auto-archive contacts on a date you choose** — A contact can now **file itself away on a date you pick**. In edit mode, the new
  **Auto-archive** section carries a switch: flip it on, choose the date (it starts
  two weeks out so nothing vanishes the moment you enable it), and choose what
  happens then — **Archive** the card (shelve it, the default) or **Delete** it for
  good. It's built for the contact you only want around for a while: the pizzeria
  you add for a week's holiday and want gone when you're home again.
  
  The schedule shows in read mode too ("Archives itself on 15 August 2026"), and
  the sweep runs whenever you open the app — so a card whose date passed while the
  app was closed catches up on your next visit. A whole sweep lands as one undo
  step. Archiving a card this way clears its schedule, so restoring it from the
  Archive won't re-file it; a delete-scheduled card leaves the document for good.
- **Migrate inline cloud photos to image files automatically on open** — A document that was synced before contact photos were filed out into image
  files keeps those photos embedded in the cloud copy. The app now **migrates it
  on its own**: when it opens and finds a cloud copy that still holds inline
  photos, it files them out once in the background — you no longer have to make an
  edit or hit **Save now** to move your pictures out of the document. The sweep
  runs at most once per connection, is skipped for encrypted cloud copies (which
  keep photos in the encrypted envelope by design), and leaves an already-filed
  document untouched.
- **Choose which copy wins when connecting a cloud drive that already has contacts** — Connecting **Dropbox or Google Drive** when the drive already holds an address
  book no longer silently overwrites it. If the cloud copy differs from the
  contacts on this device, a prompt now opens and asks which one to keep: **use
  the existing cloud copy** (this device steps aside and adopts what's in the
  cloud) or **replace the cloud with this device** (your local contacts are pushed
  up, overwriting the cloud). Each side shows how many contacts and folders it
  holds so the choice is clear, and auto-save is held until you pick — so an edit
  can't decide for you. The prompt only appears at connect time; an empty cloud,
  or one that already matches this device, connects without interruption.
- **A contacts List overview page with multi-select copy and export** — A new **List** view joins the card and Archive screens, reached from the List
  button in the sidebar's action grid. It lays every contact in the active
  namespace out in the main area, **grouped under the folder** each belongs to —
  every folder a section you can collapse or expand (all start expanded). Each row
  wears a **larger avatar or glyph** beside the name, with the contact's **phone
  numbers listed under it** (tap one to call) and, optionally, their email
  addresses (tap to write). A new **List** tab in Settings toggles whether phone
  numbers and emails show.
  
  The List page also adds a **Select** mode: tick as many contacts as you like,
  then **copy them as one vCard block** to the clipboard or **export the selection**
  to a vCard or CSV file — the batch counterpart to the copy and download a single
  card already offers on its own screen.
- **Compact / spacious card size for the List view, and side-by-side numbers on wide screens** — The overview **List** page gained a **card size** setting (Settings → List):
  **Compact** keeps rows dense so more contacts fit on screen, while **Spacious**
  draws a noticeably larger avatar so a contact's photo is easy to see at a glance.
  
  On top of that, the phone numbers and emails under each name now **sit to the
  right of the name when the screen is wide enough** — so a row reads on one line
  on a desktop — and fall back to stacking under the name on a phone.
- **Choose which number the List view prefers, and label the type when several show** — The overview **List** page gained a **Prefer number** setting (Settings → List):
  show each contact's **Private** number, their **Work** number, or **Both**. When
  a contact has no number of the chosen type the row falls back to whatever it has
  — a glance is meant to be handy, not exact, and the card is one tap away. And
  whenever a row shows more than one number, each is now tagged with its
  **Private / Work** type so it's clear which is which.
- **Back button on a contact card opened from the List page** — Opening a contact from the overview **List** page now shows a **back button** at
  the left of the card's header that returns you to the list, right where you left
  off. Cards reached any other way — a sidebar pick, a search hit, a freshly
  created contact — are unchanged and show no back button.
- **Keep several photos per contact and swap between them** — A contact can now hold **more than one photo** and switch which one is shown
  whenever you like — no more deleting and re-uploading to get an old picture back.
  
  In edit mode, the avatar popover's **Photos** section shows a thumbnail for each
  picture (the current face ringed with a check), a **＋** tile to add another, and
  **Adjust** / **Remove** for the current one. Tap any thumbnail to make it the
  face. Dropping an image onto the card adds it to the gallery too, rather than
  replacing what's there.
  
  In read mode, tapping the photo opens it full-screen; when there are several,
  **swipe left and right** (or use the arrow keys) to page through them, with a
  count readout and a dot per photo so you can see how many there are.
  
  Only the **current face** is written to a downloaded or copied vCard. On a
  connected cloud drive every photo is filed out to its own binary JPEG at
  `photos/<name>-<id>-<photoId>.jpg`, so the synced document stays free of image
  data. Existing single-photo cards upgrade automatically into a one-photo gallery.

### Changed

- **Hide cloud storage backends that aren't configured in the build** — The storage backend picker now only offers a cloud provider when its OAuth
  identifier is baked into the build — Dropbox appears only when
  `VITE_DROPBOX_APP_KEY` is set, Google Drive only when `VITE_GOOGLE_CLIENT_ID`
  is set. Previously an unconfigured backend was still listed and showed a
  "key missing" warning once selected; now it's simply absent, so the picker
  only presents backends you can actually connect to. When neither key is set,
  the picker shows just **This device**.
- **Store cloud photos as binary JPEG files, kept out of the document** — On a cloud drive (Dropbox or Google Drive), contact pictures are now written as
  genuine **binary JPEG files** you can preview in the drive, instead of base64
  text. Both the display crop and the larger original are filed out
  (`photos/<name>-<id>.jpg` and `…-source.jpg`), so the synced document carries no
  image bytes at all and stays small. Photos that arrive on an **imported vCard**
  are broken out into files the same way rather than riding inline in the
  document. Nothing changes for the copy on this device — it still keeps photos
  inline so the app renders offline — and encrypted cloud copies still keep photos
  inside the encrypted envelope.
- **Important dates now require an occasion** — The **occasion** on an important date is now required. Because the occasion
  names the countdown chip and the calendar reminder ("Anniversary Sarah
  Connor"), a blank one left the date without a meaningful label. In edit mode the
  field is marked required and flags an empty occasion inline, so every important
  date carries a name.
- **Cleaner List view header with a glyph Select button** — The List view's top bar is tidier. The list glyph now sits in a tinted badge
  beside the title, the running **contact count has been dropped** (it added noise
  without telling you anything), and the text **"Select" button is now a
  checkmark-square glyph button** that matches the icon buttons already used in the
  selection toolbar.
- **List select-all is its own checkbox row, and long names wrap** — The overview **List** view's selection toolbar reads more clearly. **Select all**
  is now its own row below the count — a real checkbox that mirrors whether every
  contact is picked and, when tapped, ticks or unticks them all in one go (rather
  than a text button crammed in beside the copy and export actions).
  
  Contact names now **wrap onto as many lines as they need** instead of being cut
  off with an ellipsis, so a very long full name reads in full and can no longer
  push the row wider than the screen — the list never scrolls sideways. And
  **empty folders no longer appear** in the list: a folder shows only while it
  holds at least one active contact, so the view stays free of dead "No contacts
  in this folder." sections.

### Fixed

- **The browser tab shows the app mark instead of a folder glyph** — The website tab showed a generic **folder** icon instead of the app's mark. Two
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
