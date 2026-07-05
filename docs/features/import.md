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

Imports look out for **duplicates** instead of blindly adding copies. An
imported card that shares a phone number or email with a contact you already
have is clearly the same person, so it merges right in without asking. A card
that merely has the exact same name is _probably_ the same person, so the app
asks first — choose **Merge**, **Keep both**, or **All (n)** to merge every
remaining duplicate in the batch in one go.

A merge never loses anything: it only fills in what's missing. New numbers,
emails, addresses, and dates are added alongside the ones you have, empty
fields are filled, and a more complete name — say "Andreas Andersson" arriving
for a card that just says "Andreas" — upgrades the shorter one. What's already
on your card stays exactly as you wrote it.

Everything else lands as a new card at the root, and the whole import — merges
included — arrives as a **single undo step**, so one Undo reverses it all.
