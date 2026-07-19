// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A contact's "relationship" — how you know them. A single value on the card
// (`Contact.relation`): the five built-ins below are stored as stable lowercase
// keys so their display label can follow the UI language, while a custom
// relationship is stored — and shown — verbatim. The framework owns no picker
// for "predefined options plus your own custom value", so the edit form builds
// that affordance over `SelectPicker` from these helpers; the read view and the
// picker share `relationLabel` so a value reads the same in both places.
//
// App-local, like the emergency flag and favorites: a relationship isn't
// written to a vCard or CSV, but it round-trips through the JSON backup.

import type { TFn } from "./i18n/index.ts";
import type { Contact } from "./types.ts";

/** The five built-in relationships, as stable keys. Their display labels live
 *  in the i18n catalog under `contact.relations.<key>`; any other stored value
 *  is a custom relationship, kept and shown verbatim. */
export const DEFAULT_RELATIONS = [
  "family",
  "partner",
  "friend",
  "colleague",
  "business",
] as const;

export type DefaultRelation = (typeof DEFAULT_RELATIONS)[number];

const DEFAULT_KEYS = new Set<string>(DEFAULT_RELATIONS);

/** Whether a stored relation value is one of the five built-ins (a key), as
 *  opposed to a custom free-text label. */
export function isDefaultRelation(value: string): value is DefaultRelation {
  return DEFAULT_KEYS.has(value);
}

/** The display label for a stored relation value: the localized name for a
 *  built-in key, the verbatim text for a custom one, empty string for none. */
export function relationLabel(value: string | undefined, t: TFn): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  // A per-value catalog key computed at the call site isn't a statically known
  // leaf, so `t` needs the cast (per the repo's i18n convention).
  return isDefaultRelation(v)
    ? t(`contact.relations.${v}` as Parameters<TFn>[0])
    : v;
}

/** Fold a just-typed custom relationship onto a built-in when it names one
 *  (case-insensitively — the keys are their own English labels lowercased, so
 *  "Family" and "family" both match) so a look-alike custom value isn't created
 *  beside the built-in; otherwise keep the trimmed text as the custom label. */
export function normalizeRelationInput(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  return isDefaultRelation(lower) ? lower : v;
}

/** The distinct custom relationships already used across the address book,
 *  deduped case-insensitively and sorted — the extra options the picker offers
 *  below the built-ins, so a custom value added once is reusable everywhere. */
export function customRelationsInUse(contacts: readonly Contact[]): string[] {
  const seen = new Map<string, string>();
  for (const c of contacts) {
    const v = c.relation?.trim();
    if (!v || isDefaultRelation(v)) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) seen.set(key, v);
  }
  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}
