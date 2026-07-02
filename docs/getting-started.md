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
3. **Add a photo** — tap the avatar in the card header, Upload photo. Or pick
   a glyph and accent colour instead.
4. **Organise** — create folders from the action grid; drag contacts into
   them, or onto another namespace in the sidebar header, or onto Archive.
5. **Install it** — the deployed site is an installable PWA and works fully
   offline; updates arrive through an in-app prompt.

## Keep it synced (optional)

Settings → Storage → _Where your data lives_: pick Dropbox or Google Drive and
hit Connect. See [features/sync.md](features/sync.md) and
[configuration.md](configuration.md) for the OAuth setup a self-hosted build
needs.

## Take it with you

Settings → Storage → _Export_: vCard (`.vcf`) for Outlook/iOS/Android, CSV for
Outlook's importer, or a JSON backup. A single card exports from the download
button in its header. See [features/export.md](features/export.md).
