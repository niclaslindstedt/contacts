// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's domain types. The framework owns the generic mechanics (storage,
// namespaces, glyphs, search matching); the app owns the domain shape — a
// contact card, the folders that group cards, and the whole-document model a
// namespace persists. Contacts are stored as JSON (see `migrations.ts` for the
// on-disk versioning) and export as vCard / CSV (see `export.ts`).

/** One phone number on a contact card. `label` is a free-form tag ("mobile",
 *  "work"); it maps onto the vCard TEL TYPE on export. */
export type Phone = {
  id: string;
  value: string;
  label?: string;
};

/** One email address on a contact card. */
export type Email = {
  id: string;
  value: string;
  label?: string;
};

/** A single contact card, optionally inside a folder. */
export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  phones: Phone[];
  emails: Email[];
  /** Postal address, split into street / postal code / city (see
   *  `address.ts`). Any part may be absent. */
  street?: string;
  zip?: string;
  city?: string;
  /** ISO date (`YYYY-MM-DD`). */
  birthday?: string;
  notes?: string;
  /** Contact photo as a data URI (downscaled JPEG), or absent. */
  photo?: string | null;
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
