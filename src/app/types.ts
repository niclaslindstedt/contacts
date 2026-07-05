// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's domain types. The framework owns the generic mechanics (storage,
// namespaces, glyphs, search matching); the app owns the domain shape — a
// contact card, the folders that group cards, and the whole-document model a
// namespace persists. Contacts are stored as JSON (see `migrations.ts` for the
// on-disk versioning) and export as vCard / CSV (see `export.ts`).

/** The type of a phone number or email address. A contact method is either a
 *  personal ("private") one or a work one — the two the edit form's type
 *  selector offers. Stored in the row's `label`; `methodKind` reads it back,
 *  folding any legacy free-form label ("mobile", "home", …) onto these two. */
export type ContactMethodKind = "private" | "work";

/** Normalise a stored `label` to one of the two contact-method kinds. Anything
 *  that isn't explicitly "work" reads as "private" — so a legacy "mobile" /
 *  "home" / "personal" label, and an absent one, all show as Private. */
export function methodKind(label: string | undefined): ContactMethodKind {
  return (label ?? "").trim().toLowerCase() === "work" ? "work" : "private";
}

/** One phone number on a contact card. Stored **structured**: `value` is the
 *  national significant number as *pure digits* — no country code, no spaces,
 *  no hyphens (the edit form strips separators on entry, and `migrations.ts`
 *  normalises older free-typed numbers) — and `countryCode` is the E.164
 *  calling code without the leading `+` ("46", "1"), picked from the edit
 *  form's country dropdown. An absent `countryCode` means "the home country"
 *  (see `settings.country`), so a plain local number needs no explicit code.
 *  `label` carries the {@link ContactMethodKind} ("private" / "work"); it maps
 *  onto the vCard TEL TYPE on export. */
export type Phone = {
  id: string;
  value: string;
  /** E.164 country calling code without the `+` ("46", "1"), or absent for a
   *  number that follows the home country. */
  countryCode?: string;
  label?: string;
};

/** One email address on a contact card. `label` carries the {@link
 *  ContactMethodKind}, the same way a phone's does. */
export type Email = {
  id: string;
  value: string;
  label?: string;
};

/** One postal address on a contact card. A card can hold several — a home, a
 *  cabin, a workplace — each with a free-text `label` ("Home", "Cabin",
 *  "Work"). Any of the three structured parts (see `address.ts`) may be absent. */
export type Address = {
  id: string;
  /** Free-text title for the address ("Home", "Cabin", "Work"). */
  label?: string;
  street?: string;
  zip?: string;
  city?: string;
};

/** One important date on a contact card, beyond the birthday — a name day, an
 *  anniversary, whatever the card's owner wants to be reminded of. `label` is
 *  free text ("Anniversary", "Name day"); `date` is a full ISO `YYYY-MM-DD`
 *  when the year is known, or a bare `MM-DD` when it isn't (see
 *  `importantDates.ts`). Tapping the date in the read view hands a yearly
 *  reminder — titled "{label} {name}" — to the device calendar. */
export type ImportantDate = {
  id: string;
  label?: string;
  date: string;
};

/** What the auto-archive sweep does to a contact when its scheduled date
 *  arrives: shelve the card in the Archive ("archive"), or drop it from the
 *  document for good ("delete"). Stored on the contact next to the date. */
export type AutoArchiveAction = "archive" | "delete";

/** How a contact photo is framed inside the circle — the Facebook-style
 *  zoom/pan the cropper produces and restores. `scale` multiplies the
 *  cover-fit baseline (1 = the image just fills the circle); `x`/`y` pan the
 *  source within the crop viewport, in unit-square terms (0 = centred, ±0.5 =
 *  an edge at the centre). Kept resolution-independent so the same framing
 *  bakes at any output size. */
export type PhotoTransform = {
  scale: number;
  x: number;
  y: number;
};

/** One file attached to a contact — a restaurant's menu, a signed contract, a
 *  scanned business card. A card can carry several. Each entry is
 *  self-contained: the file's own `name` and `mime` type, an optional free-text
 *  `description`, the byte `size` (for the read-view badge), and the file's
 *  bytes as a `data:` URI (`data`, what the thumbnail / viewer / download read).
 *  On a cloud backend the bytes are externalised to a real binary file at a
 *  deterministic path (`dataPath`) and stripped from the synced document (see
 *  `attachmentStore.ts`), mirroring how photos are filed out; `dataPath` is
 *  absent until the file is externalised. Kept app-local — an attachment isn't
 *  written to a vCard or CSV, but it does round-trip through the JSON backup. */
export type Attachment = {
  id: string;
  /** The original file name, shown as the attachment's title ("menu.pdf"). */
  name: string;
  /** The file's MIME type ("application/pdf", "image/png"); drives the
   *  image-thumbnail vs. file-row choice and how the bytes are re-wrapped on
   *  load. */
  mime: string;
  /** The file's size in bytes, kept for the read-view size badge. */
  size?: number;
  /** An optional note about the file ("Lunch menu, updated 2024"). */
  description?: string;
  /** The file's bytes as a base64 `data:` URI. Present on the local working
   *  copy; on a plaintext cloud backend it's externalised to {@link dataPath}
   *  and stripped, then re-hydrated on load. */
  data?: string | null;
  /** The deterministic cloud file path the bytes are externalised to; absent
   *  until the file is filed out. */
  dataPath?: string | null;
};

/** One photo in a contact's gallery. A card can carry several — a headshot, a
 *  candid, a logo — and swap which one is its face at will (see
 *  {@link Contact.activePhotoId} and `contactPhotos.ts`). Each entry is
 *  self-contained: the baked circular-crop square JPEG data URI (`photo`, what
 *  the avatar and export read), the resized original the crop was taken from
 *  (`photoSource`, kept so "Adjust" reopens the cropper), and the framing that
 *  produced the crop (`photoTransform`). On a cloud backend the two images are
 *  externalised to binary JPEG files at deterministic paths (`photoPath` /
 *  `photoSourcePath`) and stripped from the synced document (see
 *  `photoStore.ts`); those paths are absent until the photo is externalised. */
export type ContactPhoto = {
  id: string;
  photo?: string | null;
  photoSource?: string | null;
  photoTransform?: PhotoTransform | null;
  photoPath?: string | null;
  photoSourcePath?: string | null;
};

/** A single contact card, optionally inside a folder. */
export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  /** Marks the card as a **company** rather than a person. When set, the card
   *  is identified by its {@link company} name alone (the name area edits the
   *  company, not a first/last name) and wears a building glyph by default.
   *  Absent / `false` means an ordinary person. Kept app-local — but it does map
   *  onto the vCard's `X-ABShowAs:COMPANY` hint on export. */
  isCompany?: boolean;
  /** The contact's website — a full URL ("https://example.com"). Shown as a
   *  tap-to-open link in the read view and mapped onto the vCard `URL`. */
  homepage?: string;
  phones: Phone[];
  emails: Email[];
  /** Postal addresses, each split into street / postal code / city (see
   *  `address.ts`) and titled with a free-text label. A card may carry none,
   *  one, or several. */
  addresses: Address[];
  /** The birthday, kept as its own field so it can drive the age readout and
   *  the vCard `BDAY`. Always a full ISO date (`YYYY-MM-DD`). Other notable
   *  dates live in `importantDates`. */
  birthday?: string;
  /** Extra notable dates — name days, anniversaries, … — each with its own
   *  free-text label. Separate from `birthday`, which stays special. */
  importantDates: ImportantDate[];
  notes?: string;
  /** The contact's gallery of photos (see {@link ContactPhoto}). A card can
   *  hold several and swap between them without re-uploading; the one shown
   *  everywhere the avatar appears is picked by {@link activePhotoId}. Absent or
   *  empty means no photo — the avatar falls back to the glyph / initials.
   *  Access it through the helpers in `contactPhotos.ts` rather than reaching
   *  in directly, so the "which one is the face" rule stays in one place. */
  photos?: ContactPhoto[];
  /** Which gallery entry is the current face. When absent (or pointing at a
   *  since-removed entry) the first photo in {@link photos} is used, so a card
   *  imported or migrated with a single photo needs no explicit selection. */
  activePhotoId?: string | null;
  /** Files attached to the card (see {@link Attachment}) — a menu, a contract,
   *  a scanned card. Absent or empty means none. Access it through the helpers
   *  in `attachments.ts` rather than reaching in directly. */
  attachments?: Attachment[];
  // `null` for a standalone (ungrouped) contact shown at the menu's root.
  folderId: string | null;
  // The card's appearance when it has no photo — a glyph name (from the
  // framework's catalogue) and an accent colour.
  glyph?: string | null;
  color?: string | null;
  // Set when the contact is archived (swiped right in the side menu). Archived
  // contacts stay in the document — they drop out of the menu but the Archive
  // counter tallies them and an Undo brings them back.
  archived?: boolean;
  /** Marks the card as an **in-case-of-emergency** contact. Flagged cards are
   *  pinned to a dedicated section at the very top of the side menu (regardless
   *  of which folder they're filed in) and wear a badge, so a next-of-kin or
   *  first responder is reachable at a glance. Absent / `false` means an
   *  ordinary contact. Kept app-local — it isn't written to a vCard or CSV, but
   *  it does round-trip through the JSON backup. */
  ice?: boolean;
  // Set when the card is starred as a favorite (the heart on its screen or a
  // List row). Favorites stay in the document like any other card, but also
  // gather on their own Favorites page — a quick-access shortlist of the people
  // you reach for most. Absent (or false) means not a favorite.
  favorite?: boolean;
  /** The card's manual position on the Favorites page, low to high. The
   *  Favorites page is a hand-orderable shortlist (drag to reorder); this is the
   *  saved order. Absent on a card that has never been placed — those sort after
   *  ordered cards, by name — so only reordering assigns explicit positions. */
  favoriteOrder?: number;
  /** When set, the card files itself away without being touched: on or after
   *  this day the app's sweep either archives it or deletes it (see
   *  {@link autoArchiveAction}). A full ISO `YYYY-MM-DD`. Handy for a contact
   *  you only want around for a while — a holiday pizzeria that should tidy
   *  itself away when the trip ends. Cleared once the sweep archives the card,
   *  so restoring it from the Archive doesn't re-file it. */
  autoArchiveDate?: string;
  /** What the sweep does when {@link autoArchiveDate} arrives — shelve the card
   *  or delete it for good. Absent (or with no date set) means auto-archiving
   *  is off; a bare date with no action defaults to archiving. */
  autoArchiveAction?: AutoArchiveAction;
};

/** A folder groups contacts in the side menu under one collapsible row.
 *  Folders nest: a folder with a {@link parentId} is a **subfolder** of that
 *  folder (Family ▸ Spouse ▸ Cousins), to any depth. */
export type Folder = {
  id: string;
  name: string;
  /** The folder this one nests inside, or `null`/absent for a **root** folder
   *  shown at the top level of the menu. A subfolder inherits its parent's fate
   *  — archiving, deleting, or moving a folder to another namespace carries the
   *  whole subtree with it. An id that points at no present folder (a parent
   *  that was pruned) is treated as a root, so a folder is never orphaned. */
  parentId?: string | null;
  // Set when the folder is archived; archiving a folder archives its contacts
  // and its subfolders with it. A held flag, not a delete.
  archived?: boolean;
};

/** The whole app document — one namespace's folders and contacts. Which
 *  namespace this document belongs to is the registry's concern (see
 *  `useNamespaces`), so the document itself carries no namespace identity. */
export type AppData = {
  folders: Folder[];
  contacts: Contact[];
  activeContactId: string;
};

/** The name shown for a card everywhere: "First Last", either half alone, the
 *  company as a fallback, or empty (the caller renders its own placeholder). */
export function displayName(
  c: Pick<Contact, "firstName" | "lastName" | "company">,
): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.company?.trim() || "";
}

/** Up-to-two-letter monogram for the avatar fallback ("NL" for Niclas
 *  Lindstedt), or empty when the card is nameless. */
export function initials(
  c: Pick<Contact, "firstName" | "lastName" | "company">,
): string {
  const first = c.firstName.trim()[0] ?? "";
  const last = c.lastName.trim()[0] ?? "";
  const both = `${first}${last}`;
  if (both) return both.toUpperCase();
  return (c.company?.trim()[0] ?? "").toUpperCase();
}

/** Split a free-typed full name ("Ada Lovelace") into the first/last halves a
 *  card stores — the inline "new contact" editor collects one string. */
export function splitFullName(full: string): {
  firstName: string;
  lastName: string;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

/** Alphabetical menu order: by display name, nameless cards last. */
export function compareContacts(a: Contact, b: Contact): number {
  const an = displayName(a);
  const bn = displayName(b);
  if (!an && !bn) return 0;
  if (!an) return 1;
  if (!bn) return -1;
  return an.localeCompare(bn, undefined, { sensitivity: "base" });
}
