# Getting started

## Use it

The app is a static PWA — open the deployed site, or run it locally:

```sh
npm install     # needs a read:packages token for GitHub Packages, see README
npm run dev
```

On first launch you land in the **Personal** namespace with one blank card.

1. **Create a contact** — the `+` button in the sidebar's action grid, type a
   full name, press Enter. The card opens in the main area.
2. **Fill in the card** — phone numbers and emails are lists (add as many as
   you like, label them Mobile/Home/Work); company, address, birthday, and
   notes are plain fields. Every field saves when you leave it.
3. **Add a photo** — tap the avatar in the card header, then **Upload photo**
   in the Photo section, and frame it in the circle cropper (drag to move, pinch
   or scroll to zoom). Adjust it later, tap it in read mode to view it
   full-screen, or pick a glyph and accent colour instead.
4. **Organise** — create folders from the action grid; drag contacts into
   them, or onto another namespace in the sidebar header, or onto Archive.
   Folders sort alphabetically by default; switch Settings → **General** →
   _Folders_ to **Manually** to arrange them yourself by dragging one folder
   onto another.
5. **Browse the list** — the **List** button in the action grid opens a
   full-page overview of everyone in the namespace, grouped by folder, with
   phone numbers under each name (tap to call). Use **Select** there to copy or
   export several contacts at once. Settings → **List** toggles whether phone
   numbers and emails show.
6. **Install it** — the deployed site is an installable PWA and works fully
   offline; updates arrive through an in-app prompt.

## Choose your formats (optional)

Settings → **Format** is organised around a **country**. Pick yours — Sweden or
the United States to start — and phone numbers and postal codes are shown that
country's way: Sweden's `+46 (0)76-818 13 37` and `123 45`, or the US's
`+1 (202) 555-0100` and `12345-6789`. A number that carries its own country
code (`+1`, `+46`) is formatted for that country automatically, so a Swedish
address book still shows a US number the American way.

A few toggles fine-tune the details without changing country: whether to format
phone numbers at all, whether to show the international country code, whether to
show the leading-zero trunk digit, and whether to group postal codes with
spaces. Each country decides what those toggles mean and ignores the ones it has
no use for. The birthday **date** keeps its own independent style — ISO, US,
European, or a long `3 July 2026` form.

Every section previews your choice with a live sample. These change the display
only — what you typed is stored untouched, and focusing a phone field reveals
the raw value for editing.

## Keep it synced (optional)

Settings → Storage → _Where your data lives_: pick a **local folder** (a
directory on this computer — no account, Chromium-based browsers only), or
**Dropbox** / **Google Drive**, and hit Connect. See
[features/sync.md](features/sync.md) and [configuration.md](configuration.md)
for the OAuth setup a self-hosted build needs (the local folder needs none).

## Take it with you

Settings → Storage → _Export_: vCard (`.vcf`) for Outlook/iOS/Android, CSV for
Outlook's importer, or a JSON backup. A single card exports from the download
button in its header. See [features/export.md](features/export.md).
