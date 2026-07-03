# Export

Contacts are stored as JSON and export from Settings → Storage (or per-card
from the header's download button):

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
  fidelity — every titled address, and day-and-month-only important dates that
  vCard 3.0 can't express.
