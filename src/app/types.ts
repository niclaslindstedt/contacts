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

/** One phone number on a contact card. `label` carries the {@link
 *  ContactMethodKind} ("private" / "work"); it maps onto the vCard TEL TYPE on
 *  export. */
export type Phone = {
  id: string;
  value: string;
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

/** A single contact card, optionally inside a folder. */
export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
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
  /** The contact's face, shown everywhere the avatar appears: the baked
   *  circular-crop square JPEG data URI (see `photo.ts`), or absent. Held inline
   *  on this device so the menu renders without fetching originals; on a cloud
   *  backend it is externalised to a binary JPEG file (`photoPath`) and stripped
   *  from the synced document (see `photoStore.ts`). The fields below describe
   *  how it was made so the crop can be re-adjusted and the original
   *  re-exported. */
  photo?: string | null;
  /** The resized original the crop was taken from (a larger JPEG data URI),
   *  kept so "Adjust" reopens the cropper at the same source. On a cloud
   *  backend this is externalised to a binary JPEG file (`photoSourcePath`) and
   *  stripped from the synced document once the file is written. */
  photoSource?: string | null;
  /** The framing the last crop used, so the cropper restores it: `scale` is the
   *  zoom over the cover-fit baseline, `x`/`y` the pan offset in the crop
   *  viewport's unit square (0 = centred). */
  photoTransform?: PhotoTransform | null;
  /** The deterministic file path the display crop lives at on a cloud backend
   *  (`photos/<name>-<id>.jpg`) — a real JPEG, easy to preview in the drive.
   *  Absent until the photo is externalised. */
  photoPath?: string | null;
  /** The file path the larger source original lives at on a cloud backend
   *  (`photos/<name>-<id>-source.jpg`). Absent until externalised. */
  photoSourcePath?: string | null;
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

/** A folder groups contacts in the side menu under one collapsible row. */
export type Folder = {
  id: string;
  name: string;
  // Set when the folder is archived; archiving a folder archives its contacts
  // with it. A held flag, not a delete.
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
