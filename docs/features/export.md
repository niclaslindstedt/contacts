# Export

Contacts are stored as JSON and export from Settings → Storage (or per-card
from the header's download button):

- **vCard 3.0 (`.vcf`)** — one file with every card, including embedded photos.
  Imports directly into iOS Contacts, Android/Google Contacts, and Outlook.
- **CSV** — Outlook's classic import columns (First Name, Last Name, Mobile
  Phone, E-mail Address, …), which Google Contacts also maps.
- **JSON backup** — the app's own on-disk document, versioned so a future build
  can always read it back.
