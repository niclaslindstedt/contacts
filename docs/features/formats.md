# Formats

**Settings → Format** decides how the value-shaped fields on a card — phone
numbers and postal codes — are shown. It changes the **display only**: whatever
you typed is stored untouched, so switching formats reformats every card at once
without ever rewriting your data. Each picker previews your current choice with
a live sample.

## Pick a country

The tab is organised around a **country**. Pick yours — **Sweden** or the
**United States** to start — and phone numbers and postal codes are shown that
country's way:

- **Sweden** — `+46 (0)76-818 13 37` and `123 45`.
- **United States** — `+1 (202) 555-0100` and `12345-6789`.

A number that already carries its own country code (`+1`, `+46`) is formatted
for **that** country automatically, so a Swedish address book still shows a US
number the American way — you don't have to switch countries to read it.

## Fine-tune the details

A few toggles adjust the details without changing country:

- whether to format phone numbers at all,
- whether to show the international country code,
- whether to show the leading-zero trunk digit, and
- whether to group postal codes with spaces.

Each country decides what those toggles mean and quietly ignores the ones it has
no use for, so the same switches read sensibly whichever country you pick.

## Dates

The birthday and other important dates follow a **date format** of their own —
ISO (`2026-07-03`), US (`07/03/2026`), European (`03/07/2026`), or a long
`3 July 2026`. As with the rest of the tab, the stored date is never rewritten;
only how it reads on the card changes.

## Adding more countries

The country list is meant to grow — each new country is one self-contained file
describing how it formats a number and a postal code, so support for another
region is a small, isolated addition rather than a rework of the settings.
</content>
