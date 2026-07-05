# contacts

A local-first contacts PWA built on
[`@niclaslindstedt/oss-framework`](https://github.com/niclaslindstedt/oss-framework)
— your address book lives on your device as JSON, optionally syncs to a local
folder, Dropbox, or Google Drive (with encryption at rest), and exports as
vCard/CSV for Outlook, iOS, and Android.

[![CI](https://github.com/niclaslindstedt/contacts/actions/workflows/ci.yml/badge.svg)](https://github.com/niclaslindstedt/contacts/actions/workflows/ci.yml)
[![Pages](https://github.com/niclaslindstedt/contacts/actions/workflows/pages.yml/badge.svg)](https://github.com/niclaslindstedt/contacts/actions/workflows/pages.yml)
[![Release](https://github.com/niclaslindstedt/contacts/actions/workflows/release.yml/badge.svg)](https://github.com/niclaslindstedt/contacts/actions/workflows/release.yml)
[![License: PolyForm-Noncommercial-1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](LICENSE)

## Why?

- **Your contacts are yours.** Everything lives on your device first — no
  account, no server, works fully offline as an installable PWA.
- **Sync when you want it.** Point it at a local folder on your computer (a
  browsable, git-trackable tree — no account, no network) or connect Dropbox or
  Google Drive, and the app keeps an off-device copy in sync — optionally
  wrapped in an AES-GCM envelope keyed by a passphrase that never leaves memory.
- **Never locked in.** One tap exports vCard 3.0 (imports straight into
  Outlook, iOS, and Android/Google Contacts), Outlook-compatible CSV, or a
  versioned JSON backup.
- **Organised like you think.** Folders that nest into subfolders,
  drag-and-drop, archive instead of delete (or auto-archive on a date),
  undo/redo everywhere, and namespaces — whole separate address books for work
  and life.
- **Pleasant to live in.** Photos, themes, full-text search, achievements, and
  an English/Swedish UI, all from the shared framework surface.

## Prerequisites

- Node.js ≥ 22 (CI pins 24 — see `.nvmrc`)
- npm ≥ 10
- A GitHub personal access token with `read:packages` (the framework package
  is served from GitHub Packages)

## Install

The `@niclaslindstedt` scope resolves from GitHub Packages (see the committed
[`.npmrc`](.npmrc)). GitHub Packages requires authentication even for public
packages, so add a token to your `~/.npmrc` once:

```
//npm.pkg.github.com/:_authToken=<your read:packages token>
```

Then:

```sh
git clone https://github.com/niclaslindstedt/contacts.git
cd contacts
npm install
```

## Quick start

```sh
npm run dev        # start the dev server
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Open the app, hit **New contact** (the `+` in the sidebar), type a name, press
Enter — and start filling in the card.

## Usage

- **New contact / folder** — the action grid at the foot of the sidebar; type
  the name inline to create.
- **List** — the app opens on the **List**, a full-page overview of every
  contact grouped by folder, with rows sized **Compact** or **Spacious** (and a
  preferred Private/Work number) from Settings → List. Collapse or expand every
  folder from the header, or **Select** to copy or export a batch at once.
- **Organise** — drag a contact into a folder, onto another namespace, or onto
  Archive; nest folders into subfolders to any depth by dragging one onto
  another. On the **List** and **Favorites** pages, swipe a row right to archive,
  left to delete — folder headings swipe too — with a desktop right-click menu
  for Move to folder / Archive / Delete. An archive or delete raises a brief
  **Undo** toast, and everything is one Undo away (Ctrl/Cmd-Z) besides. A card
  can even **auto-archive itself** — shelved or deleted — on a date you pick,
  handy for a contact you only need for a while.
- **In case of emergency** — flip the emergency switch at the bottom of a card's
  edit view (or use a row's menu) to pin it to an **In case of emergency**
  section at the top of the sidebar, in reach no matter which folder it lives in.
- **Read & edit** — a contact opens in read mode, laid out to scan; the pencil
  in the toolbar flips it into edit mode (and the check flips it back). Tappable
  phone and email rows — each typed Private or Work — call and compose straight
  from read mode. Phone numbers are entered as plain national digits with the
  country code on a per-row dropdown (defaulting to your home country), so the
  stored number stays clean. A card holds several titled addresses (home, cabin,
  work) and,
  beyond the birthday, any number of important dates (name day, anniversary) that
  can be a full date or day-and-month-only; tapping one drops a yearly calendar
  reminder titled with the occasion and the contact's name.
- **Photos & appearance** — in edit mode, tap the avatar to add one or more
  photos, each framed in a circle cropper (zoom + pan); tap a thumbnail to swap
  which one is the face, adjust or remove it, or pick a glyph + accent colour
  instead. Tap a photo in read mode to view it full-screen and swipe between the
  gallery; only the current face exports to a vCard. On a cloud drive each photo
  is filed at `photos/<name>-<id>-<photoId>.jpg`; because that name is
  deterministic the app re-indexes lost photo files back onto their contacts on
  open, and adopts an image you drop into the folder under the same pattern.
- **Favorites** — tap the heart on a contact's card (or on any List row) to star
  it; the **Favorites** button in the action grid opens a flat shortlist of just
  the starred contacts that you **drag to reorder** (grab the grip on a row).
  Mark one of a contact's numbers as their **primary** and Favorites shows just
  that number, so a starred contact reads as a single tap-to-call.
- **Website & company** — add a homepage in edit mode (it becomes a tap-to-open
  link and exports as the vCard `URL`), and flip **Company contact** to turn a
  card into an organisation — one company name, a building icon, exported so it
  lands as a company (its numbers and emails drop the private/work type).
- **Attachments** — clip files to a contact (a menu, a contract, a scanned
  card), each with an optional description. Images show as thumbnails you tap to
  expand; PDFs open in a tab, other files download. On a cloud drive they're
  filed under `attachments/` as real, previewable files.
- **Search** — the magnifier in the action grid; matches names, numbers,
  emails, addresses, and notes (`*`/`?` wildcards, `/regex/`).
- **Export** — the download button in the card header (single vCard) or
  Settings → Storage (all contacts as `.vcf`, CSV, or JSON).
- **Import** — drag a `.vcf` (or CSV / JSON backup) straight onto the contact
  screen — handy for dropping a card shared out of the iOS Contacts app — or
  pick a file from Settings → Storage. Duplicates merge instead of piling up: a
  card sharing a phone/email merges silently, a matching name asks first, and a
  merge only fills in what's missing. See [`docs/export.md`](docs/export.md).
- **Backups** — Settings → Storage → Backups: download the whole address book as
  a dated, compressed `.zip` (photos and attachments included) or restore one
  from disk. Connect a local folder or cloud drive to browse, take, and restore
  dated snapshots kept off-device in a `backups/` folder.
- **Sync** — Settings → Storage: pick a local folder or connect Dropbox or
  Google Drive; the sync glyph in the card header shows the save state and opens
  the sync command centre, where an **Open in {provider}** button jumps straight
  to your synced files on the drive's own web UI. Connecting a backend that
  already holds contacts asks whether to keep the synced copy or replace it with
  this device.

### Install as an app

The deployed site is an installable PWA: use your browser's _Install app_
affordance (or on iOS, Safari → Share → _Add to Home Screen_). The installed
app works fully offline and surfaces new deploys through an in-app update
prompt — check manually from the sidebar's _Check for updates_ row. The site
also serves two no-login pages: a `/privacy` policy spelling out what's stored
and when it leaves your device, and a `/home` showcase linked from the cloud
providers' consent screens.

## Configuration

Cloud sync needs OAuth app identities baked into the build as Vite env vars —
see [docs/configuration.md](docs/configuration.md):

| Variable                  | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `VITE_DROPBOX_APP_KEY`    | Dropbox app key (PKCE flow, no secret)                                  |
| `VITE_GOOGLE_CLIENT_ID`   | Google OAuth client id (GIS token flow)                                 |
| `VITE_DROPBOX_APP_FOLDER` | Dropbox app-folder name for the "Open in" link (defaults to `Contacts`) |
| `VITE_GDRIVE_APP_FOLDER`  | Google Drive folder name for stored documents (defaults to `Contacts`)  |
| `VITE_DONATE_URL`         | Donate link target (defaults to the project's GitHub Sponsors page)     |
| `VITE_BASE`               | Deploy base path — `/` (release), `/preview/` (main), `/branch/` (slot) |

## Examples

See [`examples/`](examples/) for a sample exported vCard and CSV, exactly as
the app produces them.

## Troubleshooting

- **`npm install` returns 401** — the GitHub Packages token is missing; see
  Install above.
- **The Connect buttons explain a missing key** — the OAuth env vars weren't
  set at build time; see Configuration.
- More in [docs/troubleshooting.md](docs/troubleshooting.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Licensed under [PolyForm Noncommercial 1.0.0](LICENSE) — the same license as
the framework and the reference app this project is derived from.
