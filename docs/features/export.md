# Export

Contacts are stored as JSON and export from Settings → Storage (all contacts),
per-card from the header's download button, or a chosen few from the **List**
page's Select mode — tick contacts and copy them as a vCard block or export the
selection to a vCard / CSV file:

- **vCard 3.0 (`.vcf`)** — one file with every card, including embedded photos.
  Imports directly into iOS Contacts, Android/Google Contacts, and Outlook. A
  phone number or email's Private / Work type maps onto the standard `TEL` /
  `EMAIL` TYPE; each address becomes its own `ADR` line (typed from its title);
  a website exports as `URL`; a card marked as a company exports its name as the
  organisation (`ORG`) and carries `X-ABShowAs:COMPANY` so it lands as an
  organisation, not a person; the birthday exports as
  `BDAY`, and other full-date important dates ride as Apple-style grouped
  `X-ABDATE` / `X-ABLABEL` items so iOS/macOS Contacts restore them under their
  occasion.
- **CSV** — Outlook's classic import columns (First Name, Last Name, Mobile
  Phone, E-mail Address, …), which Google Contacts also maps. Work numbers fill
  the Business column and private ones the Mobile column; the first address fills
  Home Address.
- **JSON backup** — the app's own on-disk document, versioned so a future build
  can always read it back. This is the only format that keeps everything at full
  fidelity — every titled address, day-and-month-only important dates that
  vCard 3.0 can't express, the **in-case-of-emergency** flag, the favorites
  order, and **attachments** (none of which have a vCard or CSV field, so they
  survive only in a JSON backup).

## Import

Bring contacts in from another address book two ways:

- **Drag and drop** — drag a file straight onto the contact screen. A dashed
  overlay confirms the drop target; releasing reads the cards and files them
  into the current address book, opening the first. On iOS/iPadOS you can share
  a contact out of the Contacts app as a `.vcf` and drop it right in.
- **Settings → Storage → Import** — choose one or more files with the picker
  for the same result without dragging.

The same three formats round-trip:

- **vCard (`.vcf`)** — one or many cards, from iOS/Android/Outlook or the app's
  own export. Names (`N`/`FN`), company (`ORG`), the company hint
  (`X-ABShowAs:COMPANY`), website (`URL`), phones/emails (typed Private / Work
  from their `TEL`/`EMAIL` TYPE), addresses (`ADR`), the birthday (`BDAY`,
  including a yearless `--MM-DD` kept as an important date), Apple grouped
  `X-ABDATE` important dates, notes, and an embedded base64 `PHOTO` all come
  across. Folded lines and quoted-printable (old vCard 2.1) values are decoded.
- **CSV** — the Outlook/Google columns the export uses, matched by header name;
  unknown columns are ignored.
- **JSON backup** — the app's own document, run through the migration pipeline
  so an older backup is upgraded on the way in. Archived cards are skipped.

Imported cards are always added (never merged over existing ones) and land at
the root; every card and field gets a fresh id, and the whole batch is a single
undo step. A file that yields nothing is a no-op with a short "no contacts
found" note. The readers are pure and node-tested (`tests/import_test.ts`); the
file-reading glue lives in `importFiles.ts` and the drop UI in
`ImportDropZone.tsx`.

## Backups

Import/export moves individual cards between address books; **backups** capture
the _whole_ document — every contact, folder, photo, and attachment — as a
single dated snapshot. A backup is a compressed `.zip` holding one
`contacts.json` (the full JSON backup above, with photos and attachments
inline), so it is self-contained regardless of which backend externalises those
files day to day. Deflate compression claws back most of the base64 bloat the
inline images add. The archive reader/writer is dependency-free — it uses the
platform's `CompressionStream`, falling back to a stored (uncompressed) entry
where that codec is missing (`zip.ts`); the backup surface itself is `backup.ts`.

From **Settings → Storage → Backups** you can:

- **Download backup (.zip)** — save a snapshot straight to disk, without writing
  it anywhere else. The download name is `contacts-<timestamp>.zip`.
- **Restore from file…** — pick a downloaded `.zip` and replace the current
  document with it. This is destructive, so it asks first; when a backend is
  connected it files a safety-net backup of the current data before overwriting.

When a **file-backed backend is connected** (a picked local folder, Dropbox, or
Google Drive) and the copy isn't encrypted, **Browse backups** opens a manager
over a `backups/` folder on that backend, mirroring what other snapshot UIs
offer:

- **Back up now** writes a fresh snapshot into `backups/`, named
  `contacts-<namespace>-<timestamp>-c<contacts>-f<folders>.zip` — the timestamp
  and counts ride in the file name so the list renders from a directory listing
  alone, without downloading every archive.
- Each row can be **downloaded**, **deleted**, or **restored**. Restoring first
  files the current document as its own safety-net snapshot, then adopts the
  chosen one — which the sync engine pushes back up as the live copy.

Backups are plaintext archives, so the off-device manager is hidden while
**encryption at rest** is on (a plaintext snapshot must not land beside an
AES-GCM envelope). Download and restore-from-file still work from disk. Backups
are per-namespace: the browse list only shows the current namespace's snapshots.
