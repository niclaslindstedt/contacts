// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Free-form tags on a contact — many per card, each any text ("Boat club",
// "Board games"). Unlike the single-valued relationship, tags are an open set
// the user grows as they go: the edit form is a chip list with a text field
// that suggests (typeahead) the tags already used across the address book, but
// never limits you to them. These are the pure helpers behind that field and
// the read view; the framework ships no tag-input primitive, so the widget is
// app-local too.
//
// App-local, like the relationship and the emergency flag: tags aren't written
// to a vCard or CSV, but they round-trip through the JSON backup.

import type { Contact } from "./types.ts";

/** A card's tags, always as an array (an absent list reads as none). */
export function contactTags(contact: Pick<Contact, "tags">): string[] {
  return contact.tags ?? [];
}

/** Add a tag to a list — trimmed, and deduped case-insensitively (the
 *  first-seen casing wins). A blank or already-present tag leaves the list
 *  unchanged, returning the *same* array reference so a caller can skip the
 *  no-op commit with a simple identity check. */
export function withTagAdded(tags: readonly string[], raw: string): string[] {
  const v = raw.trim();
  if (!v) return tags as string[];
  if (tags.some((x) => x.toLowerCase() === v.toLowerCase())) {
    return tags as string[];
  }
  return [...tags, v];
}

/** Remove a tag by exact value. */
export function withTagRemoved(tags: readonly string[], tag: string): string[] {
  return tags.filter((x) => x !== tag);
}

/** The distinct tags used across the address book, deduped case-insensitively
 *  and sorted — the typeahead suggestions the tag field offers. */
export function allTags(contacts: readonly Contact[]): string[] {
  const seen = new Map<string, string>();
  for (const c of contacts) {
    for (const raw of c.tags ?? []) {
      const v = raw.trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (!seen.has(key)) seen.set(key, v);
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}
