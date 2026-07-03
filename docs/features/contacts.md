# Contact cards

Every contact is a card: a name, any number of phone numbers and email
addresses (each typed **Private** or **Work**), a company, any number of postal
addresses (each with a free-text title), a birthday, other important dates,
notes, and a photo.

- **Read mode by default.** Opening a contact shows it laid out to be read —
  the avatar and name lead the card, phone numbers and emails become tap-to-call
  and tap-to-email links, and the details and notes render as plain, legible
  text. Only the parts a card actually carries are shown.
- **Private / work types.** Each phone number and email address carries a type —
  Private or Work — chosen from a small dropdown in edit mode. The type is shown
  as the row's label in read mode and maps onto the standard vCard TYPE on
  export.
- **Several titled addresses.** A card can hold more than one postal address — a
  home, a cabin, a workplace. Each has a free-text **Title** (defaulting to the
  "Home" placeholder) over the street / postal code / city fields. In read mode
  each address is a link — tapping it hands the address off to your maps app (or
  opens Google Maps in the browser).
- **Birthday at a glance.** The birthday row shows a countdown chip — "Today",
  "Tomorrow", or "in N days" until the next one — and tapping the date reveals
  the contact's current age. Tapping the countdown chip hands the birthday off
  to your calendar app as an all-day event that recurs every year.
- **Other important dates.** Beyond the birthday, add any number of important
  dates — a name day, an anniversary — each with a free-text occasion (required;
  it names the countdown chip and the calendar reminder). A date can be a full
  date (month, day, and year) or **day and month only** (leave the year blank). Like the birthday, each shows a countdown chip; tapping it hands a
  yearly reminder to your calendar, titled with the occasion and the contact's
  name (e.g. "Anniversary Sarah Connor"). When a date carries a year, tapping it
  reveals how many years have passed.
- **Edit with the pencil.** The pencil in the toolbar flips the card into edit
  mode; the check flips it back. In edit mode, tap the name to rename and fill in
  the field form. Every field commits when you leave it, and each committed edit
  is one undo step. A brand-new contact opens straight in edit mode.
- **Photos.** In edit mode, tap the avatar to open the appearance popover. Its
  **Photo** section — above the colour and icon pickers — carries three glyph
  buttons: **upload**, **adjust**, and **remove**. Uploading a picture opens a
  circle cropper: drag to move and pinch or scroll (or drag the slider) to zoom,
  choosing exactly which part of the photo the circle shows — the rest is
  trimmed away. **Adjust** reopens the cropper at the same framing so you can
  re-position later. Quicker still: **drag an image straight onto the open
  contact** — a dashed drop zone appears over the card, and releasing opens the
  same cropper — no need to be in edit mode first. In read mode, tapping the
  photo opens it full-screen; swipe
  down (or press Escape) to dismiss. No photo? Pick an icon and accent colour
  instead. On a connected cloud drive the original is filed at a tidy
  `photos/<name>-<id>.jpg` path so it's easy to find — see
  [Cloud sync](feature:sync).
- **Archive, don't lose.** Swipe a contact right in the side menu (or drag it
  onto Archive) to shelve it. The Archive page restores or deletes for good.
- **Auto-archive.** In edit mode, the **Auto-archive** section lets a card file
  itself away on a date you pick — flip the switch, choose the date (it starts
  two weeks out), and choose what happens then: **Archive** (shelve it, the
  default) or **Delete** (drop it for good). Handy for a place you only need for
  a while — the pizzeria you added for a holiday — that should tidy itself away
  when the trip's over. The schedule shows in read mode ("Archives itself on
  …"), and the sweep runs whenever you open the app, so a card scheduled while
  the app was closed catches up on your next visit. Archiving a card this way
  clears its schedule, so restoring it from the Archive won't re-file it.
