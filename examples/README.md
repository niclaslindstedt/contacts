# Examples

Sample export files, byte-identical in shape to what the app's Settings →
Storage → Export produces:

- [`ada-lovelace.vcf`](ada-lovelace.vcf) — a single contact as vCard 3.0, the
  format iOS Contacts, Android/Google Contacts, and Outlook import directly.
- [`contacts.csv`](contacts.csv) — the whole book as Outlook's classic import
  columns.

To try an import round-trip: download either file and feed it to your address
book's import dialog (Outlook: File → Open & Export → Import/Export; iOS:
share the .vcf to Contacts; Google Contacts: Import).
