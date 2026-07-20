// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The List view's filter model. The overview screen can narrow the contacts it
// shows to a single relationship, a single tag, and/or one card type (person or
// company). This module is the pure shape behind that — the filter value and
// the predicate that decides whether a card passes — kept out of the component
// so it is unit-testable in node (see `tests/contactFilter_test.ts`).
//
// The relationship and tag choices offered in the picker come from the values
// actually in use across the address book, so a filter never lists an option
// that would match nothing (`relationsInUse` / `allTags`).

import { DEFAULT_RELATIONS, isDefaultRelation } from "./relation.ts";
import type { Contact } from "./types.ts";

/** Which card type the filter keeps: `all` (both), `person` (private cards), or
 *  `company` (business cards). Mirrors the `Contact.isCompany` flag. */
export type CardTypeFilter = "all" | "person" | "company";

/** The List view's active filter. Each facet is independently optional: a
 *  `null` relation / tag means "any", and `cardType === "all"` keeps both card
 *  types. A card must pass every set facet to show. */
export type ContactFilter = {
  /** A relationship value (a built-in key or a custom label), or `null` for any.
   *  Matched case-insensitively against `Contact.relation`. */
  relation: string | null;
  /** A single tag, or `null` for any. Matched case-insensitively against the
   *  card's tags. */
  tag: string | null;
  /** Which card type to keep. */
  cardType: CardTypeFilter;
};

/** The "nothing filtered" starting point — every card passes. */
export const EMPTY_FILTER: ContactFilter = {
  relation: null,
  tag: null,
  cardType: "all",
};

/** Whether any facet of the filter is set (so the view is actually narrowed). */
export function isFilterActive(f: ContactFilter): boolean {
  return f.relation !== null || f.tag !== null || f.cardType !== "all";
}

/** How many facets are set — drives the count badge on the filter button. */
export function activeFilterCount(f: ContactFilter): number {
  let n = 0;
  if (f.relation !== null) n += 1;
  if (f.tag !== null) n += 1;
  if (f.cardType !== "all") n += 1;
  return n;
}

/** Whether a contact passes the filter: it must match the card type, carry the
 *  chosen relationship, and carry the chosen tag — each facet only checked when
 *  it is set. Relationship and tag are compared case-insensitively so the stored
 *  casing doesn't matter. */
export function matchesFilter(c: Contact, f: ContactFilter): boolean {
  if (f.cardType === "person" && c.isCompany) return false;
  if (f.cardType === "company" && !c.isCompany) return false;
  if (f.relation !== null) {
    const r = (c.relation ?? "").trim().toLowerCase();
    if (r !== f.relation.trim().toLowerCase()) return false;
  }
  if (f.tag !== null) {
    const want = f.tag.trim().toLowerCase();
    const has = (c.tags ?? []).some((t) => t.trim().toLowerCase() === want);
    if (!has) return false;
  }
  return true;
}

/** Keep only the contacts that pass the filter. Returns a fresh array; an
 *  inactive filter passes the whole list through unchanged (still a copy). */
export function filterContacts(
  contacts: readonly Contact[],
  f: ContactFilter,
): Contact[] {
  if (!isFilterActive(f)) return [...contacts];
  return contacts.filter((c) => matchesFilter(c, f));
}

/** The distinct relationship values in use across the given contacts, as the
 *  options a relationship filter offers: the built-ins that appear (in their
 *  canonical order) first, then any custom labels, deduped case-insensitively
 *  and sorted. A card with no relationship contributes nothing. */
export function relationsInUse(contacts: readonly Contact[]): string[] {
  const builtins = new Set<string>();
  const customs = new Map<string, string>();
  for (const c of contacts) {
    const v = c.relation?.trim();
    if (!v) continue;
    if (isDefaultRelation(v)) {
      builtins.add(v);
    } else {
      const key = v.toLowerCase();
      if (!customs.has(key)) customs.set(key, v);
    }
  }
  const ordered = DEFAULT_RELATIONS.filter((r) => builtins.has(r));
  const customList = [...customs.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  return [...ordered, ...customList];
}
