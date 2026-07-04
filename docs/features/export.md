# Export

Contacts are stored as JSON and export from Settings → Storage (all contacts),
per-card from the header's download button, or a chosen few from the **List**
page's Select mode — tick contacts and copy them as a vCard block or export the
selection to a vCard / CSV file:

- **vCard 3.0 (`.vcf`)** — one file with every card, including embedded photos.
  Imports directly into iOS Contacts, Android/Google Contacts, and Outlook. A
  phone number or email's Private / Work type maps onto the standard `TEL` /
  `EMAIL` TYPE; each address becomes its own `ADR` line (typed from its title);
  the birthday exports as `BDAY`, and other full-date important dates ride as
  Apple-style grouped `X-ABDATE` / `X-ABLABEL` items so iOS/macOS Contacts
  restore them under their occasion.
- **CSV** — Outlook's classic import columns (First Name, Last Name, Mobile
  Phone, E-mail Address, …), which Google Contacts also maps. Work numbers fill
  the Business column and private ones the Mobile column; the first address fills
  Home Address.
- **JSON backup** — the app's own on-disk document, versioned so a future build
  can always read it back. This is the only format that keeps everything at full
  fidelity — every titled address, day-and-month-only important dates that
  vCard 3.0 can't express, and the **in-case-of-emergency** flag (which has no
  vCard or CSV field, so it survives only in a JSON backup).

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
  own export. Names (`N`/`FN`), company (`ORG`), phones/emails (typed Private /
  Work from their `TEL`/`EMAIL` TYPE), addresses (`ADR`), the birthday (`BDAY`,
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
