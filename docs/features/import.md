# Import

Bring contacts in from another address book two ways:

- **Drag and drop** — drag a file straight onto the contact screen; a dashed
  overlay confirms the drop, and releasing reads the cards and files them into
  the current address book. On iOS/iPadOS you can share a contact out as a `.vcf`
  and drop it right in.
- **Settings → Storage → Import** — pick one or more files with the file picker
  for the same result.

Three formats are understood, mirroring [export](feature:export):

- **vCard (`.vcf`)** — names, company, website, typed phones/emails, addresses,
  the birthday (including a yearless `--MM-DD`), Apple grouped `X-ABDATE`
  important dates, notes, and an embedded photo all come across; folded and
  quoted-printable lines are decoded.
- **CSV** — the Outlook/Google columns, matched by header name; unknown columns
  are ignored.
- **JSON backup** — the app's own document, run through the migration pipeline so
  an older backup is upgraded on the way in; archived cards are skipped.

Imported cards are always **added** — never merged over what you already have —
land at the root, and arrive as a **single undo step**, so one Undo reverses a
whole import.
