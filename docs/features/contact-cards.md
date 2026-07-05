# Contact cards

Every contact is a **card** — a name (or a single company name), any number of
phone numbers and email addresses, a company, a website, one or more postal
addresses, a birthday, other important dates, notes, photos, and attachments.

## Read mode and edit mode

A card opens in **read mode**, laid out to be scanned: the avatar and name lead,
phone numbers and emails become **tap-to-call** and **tap-to-email** rows, and
the rest renders as plain, legible text — only the parts a card actually carries
are shown. The **pencil** in the toolbar flips the card into **edit mode** (the
check flips it back); a brand-new contact opens straight in edit mode. Every
field commits when you leave it, and each committed edit is one undo step.

## The fields on a card

- **Phone numbers.** A number is entered — and stored — as **plain national
  digits**, with no spaces, hyphens, or country code baked in. Its **country
  code** sits on a per-row **dropdown** (a flag and a `+46`) that starts on your
  home country from **Settings → Format**; paste a number that already begins
  with `+46` / `00…` and the code jumps into the dropdown while the rest is
  stripped to bare digits. Existing numbers convert to this shape automatically.
- **Private / Work types.** Each phone number and email carries a type — a
  person glyph for **Private**, a briefcase for **Work** — flipped with a small
  toggle that doesn't steal focus, so you can type a number and set its type in
  one go. The type shows as the row's label in read mode.
- **Titled postal addresses.** A card can hold more than one address, each with
  a free-text title — see [Addresses](feature:addresses).
- **Birthday.** The birthday row shows a countdown chip — "Today", "Tomorrow",
  or "in N days" — and tapping it hands a yearly all-day event to your calendar;
  tapping the date reveals the contact's current age.
- **Other important dates.** Beyond the birthday, add any number of important
  dates — a name day, an anniversary — each with a required occasion (which names
  the countdown chip and the calendar reminder) and a date that can be full or
  **day-and-month only**.
- **Website & company.** Add a **Website** and it shows as a tap-to-open link
  (exported as the vCard `URL`). A **Company contact** switch turns the card into
  an organisation: it's named by a single company name, wears a building icon,
  clears the person-only fields (the name split, birthday, important dates),
  and exports as a company.

Photos and files have their own read-mores — see [Photos](feature:photos) and
[Attachments](feature:attachments). For the full reference, see
[the contacts documentation](../contacts.md).
