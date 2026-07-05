# Export

Export from **Settings → Storage** (all contacts), per-card from the header's
download button, or a chosen few from the [List page](feature:list)'s Select
mode. Three formats:

- **vCard 3.0 (`.vcf`)** — one file with every card, including embedded photos;
  imports directly into iOS, Android/Google, and Outlook. A phone or email's
  Private / Work type maps onto the standard `TEL` / `EMAIL` TYPE, each address
  becomes its own `ADR`, a website exports as `URL`, a company card exports its
  name as the organisation (`ORG`, with `X-ABShowAs:COMPANY`), the birthday as
  `BDAY`, and other full-date important dates as Apple-style grouped `X-ABDATE`
  items.
- **CSV** — Outlook's classic import columns (which Google Contacts also maps);
  Work numbers fill the Business column and private ones the Mobile column.
- **JSON backup** — the app's own document, versioned so a future build can
  always read it back. This is the only format that keeps **everything** at full
  fidelity — titled addresses, day-and-month-only dates, the emergency flag, the
  favorites order, and attachments, none of which have a vCard or CSV field.

To bring contacts in, see [Import](feature:import); for whole-document snapshots,
see [Backups](feature:backups).
