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
5. **Install it** — the deployed site is an installable PWA and works fully
   offline; updates arrive through an in-app prompt.

## Choose your formats (optional)

Settings → **Format**: pick how dates, phone numbers, and postal codes are
shown. Dates (the birthday) render as ISO, US, European, or a long `3 July 2026`
form; phone numbers as entered, international, national, or compact E.164; postal
codes as entered, a US 5-digit ZIP, US ZIP+4, or a grouped `123 45` style. Each
picker previews your choice with a live sample. These change the display only —
what you typed is stored untouched, and focusing a phone field reveals the raw
value for editing.

## Keep it synced (optional)

Settings → Storage → _Where your data lives_: pick Dropbox or Google Drive and
hit Connect. See [features/sync.md](features/sync.md) and
[configuration.md](configuration.md) for the OAuth setup a self-hosted build
needs.

## Take it with you

Settings → Storage → _Export_: vCard (`.vcf`) for Outlook/iOS/Android, CSV for
Outlook's importer, or a JSON backup. A single card exports from the download
button in its header. See [features/export.md](features/export.md).
