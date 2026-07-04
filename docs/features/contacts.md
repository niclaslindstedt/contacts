# Contact cards

Every contact is a card: a name, any number of phone numbers and email
addresses (each typed **Private** or **Work**), a company, a website, any number
of postal addresses (each with a free-text title), a birthday, other important
dates, notes, one or more photos, and any files you attach. A card can also be
marked as a **company** rather than a person.

- **Read mode by default.** Opening a contact shows it laid out to be read —
  the avatar and name lead the card, phone numbers and emails become tap-to-call
  and tap-to-email links, and the details and notes render as plain, legible
  text. Only the parts a card actually carries are shown.
- **List overview.** The **List** button in the sidebar's action grid opens a
  full-page overview of every contact in the namespace, **grouped under the
  folder** each belongs to. Every folder that holds a contact is a section you
  can collapse or expand (all start expanded); a folder with no contacts is left
  out of the list. Each row shows a larger avatar or glyph beside the name — a
  long name **wraps onto as many lines as it needs** rather than being cut off —
  with the contact's phone numbers listed under it (tap one to call) and,
  optionally, their emails (tap to write). On wider screens the numbers sit to
  the right of the name; on a phone they stack under it. **Settings → List**
  toggles what shows and picks the card size — **Compact** to fit more
  contacts, or **Spacious** for a larger, easier-to-see photo — and chooses which
  number to prefer (**Private**, **Work**, or **Both**); a contact with no number
  of the chosen type shows whatever it has, so open the card if the wrong one
  appears. When a row shows more than one number, each leads with a small type
  glyph — a person for Private, a briefcase for Work — the same marks the edit
  form's type toggle uses.
  Each row also carries a **heart** at its trailing edge — tap it to star (or
  unstar) that contact as a favorite without opening the card. Tap a row to open
  that contact's card — its header carries a **back button** to return to the
  list. The **Select**
  button turns the list into a multi-select: tick as many contacts as you like,
  or use the **Select all** checkbox on its own row to tick — or untick — every
  contact at once, then **Copy** them as one vCard block to the clipboard or
  **Export** the selection to a vCard or CSV file (see
  [Export & import](feature:export)).
- **Favorites.** Star the people you reach for most and they gather on their own
  **Favorites** page — the button sits next to List in the sidebar's action
  grid. Unlike the List overview, Favorites is a single **hand-orderable
  shortlist**: one flat list (not split by folder) that you arrange yourself.
  Each row carries a **grip handle** — drag a contact up or down to set the
  order; on a touch screen, press and hold the grip to pick a row up first. A
  thin line shows where the card will land — above or below the row you're over,
  depending on which half you're pointing at. The same Select / Copy / Export
  tools are here too. Toggle a favorite anywhere it
  shows: the **heart** in a contact card's header, or the heart on any List or
  Favorites row. A card opened from the Favorites page gets a back button to it,
  just like the List page. The favorite flag and its order are stored per
  contact, so they ride along in the JSON backup and sync across your devices; a
  newly starred contact joins the bottom of the list until you drag it into
  place.
- **Folders in the side menu.** Group contacts into **folders** — tap a folder
  row to collapse or expand just that one. The **Contacts** header carries a
  folder glyph that folds **every** folder shut in one tap (handy when a long
  list of folders has pushed your ungrouped contacts out of reach); once they're
  all collapsed the same glyph expands them all again.
- **Subfolders.** Folders **nest** to any depth — Family ▸ Spouse ▸ Cousins.
  Make one with a folder's **New subfolder** action (its right-click menu, or by
  swiping the folder left on touch); the subfolder shows indented under its
  parent, and collapsing a folder folds its whole subtree away with it. **Drag**
  a folder onto another to nest it inside, or onto empty space to lift it back to
  the top level (in manual folder-sort, dropping near a sibling's top or bottom
  edge still reorders them). Archiving, deleting, or moving a folder to another
  namespace carries the whole subtree along — **archiving** or **deleting** a
  folder shelves or removes every folder and contact beneath it, though a deleted
  folder's own contacts and subfolders are promoted up to its parent rather than
  lost. The List page mirrors the same indented nesting.
- **Website & company.** A card can carry a **Website** — add a homepage in edit
  mode and it shows as a tap-to-open link in read mode (and exports as the vCard
  `URL`). A **This is a company** switch — at the bottom of the edit view, beside
  the emergency flag — turns the card into a **company**: it's identified by a
  single company name instead of a first and last name, shows a building icon in
  place of a monogram, and exports with its name as the organisation (`ORG`) so
  it lands as a company in the address book you send it to. A company hides the
  person-only fields — the birthday and the extra important dates.
- **Private / work types.** Each phone number and email address carries a type —
  Private or Work — flipped with a small two-glyph toggle in edit mode (a person
  for Private, a briefcase for Work); tapping a glyph flips the type without the
  field losing focus, so you can type a number and set its type in one go. New
  numbers and addresses default to Work. The type is shown as the row's label in
  read mode and maps onto the standard vCard TYPE on export.
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
- **Photos.** A contact can hold **several photos** and swap between them
  whenever you like — no need to delete and re-upload to go back to an earlier
  one. In edit mode, tap the avatar to open the appearance popover. Its
  **Photos** section — above the colour and icon pickers — shows a thumbnail for
  each photo (the current face ringed with a check), a **＋ tile** to add
  another, and **Adjust** / **Remove** buttons for the current one. Tap any
  thumbnail to make it the face. Adding a picture opens a circle cropper: drag to
  move and pinch or scroll (or drag the slider) to zoom, choosing exactly which
  part of the photo the circle shows — the rest is trimmed away. **Adjust**
  reopens the cropper at the same framing so you can re-position later. Quicker
  still: **drag an image straight onto the open contact** — a dashed drop zone
  appears over the card, and releasing opens the same cropper, adding the photo
  and making it the face — no need to be in edit mode first. In read mode,
  tapping the photo opens it full-screen; when there are several, **swipe left
  and right** (or use the arrow keys) to page through them, with a count readout
  and a dot per photo. Swipe down (or press Escape) to dismiss. No photo? Pick an
  icon and accent colour instead. Only the **current face** is written to a
  downloaded or copied vCard. On a connected cloud drive each photo is filed at a
  tidy `photos/<name>-<id>-<photoId>.jpg` path so it's easy to find — see
  [Cloud sync](feature:sync).
- **Attachments.** Clip **files** to a contact — a restaurant's menu, a signed
  contract, a scanned business card. In edit mode, the **Attachments** section's
  **Add file** button picks one or more files, and each can carry an optional
  **description**. In read mode, image attachments show as **thumbnails** you tap
  to expand into the same full-screen viewer the profile photos use (swipe
  between several); other files list as rows — a PDF opens in a new tab, anything
  else downloads. Attachments stay in the app (not written to a vCard or CSV) but
  are kept in the JSON backup. On a connected cloud drive they're filed out as
  real, previewable files under an `attachments/` folder — the same way photos
  are — so the synced document stays lean (see [Cloud sync](feature:sync)).
  Individual files are capped at 10 MB.
- **In case of emergency.** Flag a contact as an **emergency contact** and it's
  pinned to a dedicated **In case of emergency** section at the very top of the
  side menu — regardless of which folder it's filed in — so a next-of-kin or
  first responder is one tap away. The toggle lives at the **bottom of the card's
  edit view** as a labelled switch — set it once and it stays out of the way. A
  flagged row wears a small red siren badge wherever it appears. The flag stays in the app — it
  isn't written to a vCard or CSV — but it's kept in the JSON backup, so a
  restore brings your emergency contacts back pinned.
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
