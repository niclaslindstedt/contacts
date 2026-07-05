// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Import merging — decides what happens when an imported card looks like a
// contact the address book already has, and folds the two together. Pure and
// DOM-free (like `import.ts`) so it is unit-testable in node (see
// `tests/importMerge_test.ts`).
//
// The rules, in matching order:
//
// 1. A draft sharing a **normalized phone number or email** with an existing
//    card is obviously the same person — it merges without asking, as long as
//    the two names don't outright disagree (one name extending the other, or
//    either side nameless, is fine).
// 2. A draft with the **exact same normalized name** as an existing card is a
//    *probable* duplicate — it becomes a conflict the UI confirms before
//    merging (with an "All (n)" shortcut for the rest of the batch).
// 3. Anything else imports as a brand-new card.
//
// A merge only ever **adds what's missing**: new phones/emails/addresses/dates
// are appended (deduped), empty fields are filled, and a more precise name —
// "Andreas Andersson" arriving for a card that just says "Andreas" — upgrades
// the stored one. Nothing the user already has is overwritten or removed.

import { digitsOnly } from "./format.ts";
import type { ImportedContact } from "./import.ts";
import type { Contact } from "./types.ts";
import { displayName } from "./types.ts";

/** One planned merge: the imported draft to fold into the card `targetId`. */
export type ImportMerge = { targetId: string; draft: ImportedContact };

/** A probable duplicate the user must confirm: same normalized name, but no
 *  shared phone/email to prove it's the same person. */
export type ImportConflict = {
  targetId: string;
  /** The existing card's display name, for the confirm prompt. */
  targetName: string;
  /** The incoming card's display name, for the confirm prompt. */
  draftName: string;
  draft: ImportedContact;
};

/** The batch, triaged: cards to file as new, cards to merge silently, and
 *  cards the user must decide on (a confirmed conflict becomes a merge; a
 *  declined one becomes an addition). */
export type ImportPlan = {
  additions: ImportedContact[];
  merges: ImportMerge[];
  conflicts: ImportConflict[];
};

/** Whether two stored phones are the same number. Values are national digits
 *  (see `toStoredPhone`); an absent country code means "the home country", so
 *  it matches any explicit code rather than mismatching it. */
function phonesMatch(
  a: { value: string; countryCode?: string | null },
  b: { value: string; countryCode?: string | null },
): boolean {
  const da = digitsOnly(a.value);
  if (!da || da !== digitsOnly(b.value)) return false;
  return !a.countryCode || !b.countryCode || a.countryCode === b.countryCode;
}

/** Case-insensitive email identity. */
function emailKey(value: string): string {
  return value.trim().toLowerCase();
}

/** The person-name tokens of a card — lower-cased words of "First Last". The
 *  company name is *not* folded in here; it only stands in for identity where
 *  the display name does (see {@link nameKey}). */
function personTokens(firstName: string, lastName: string): string[] {
  return `${firstName} ${lastName}`.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Whether every token of `a` appears in `b`. */
function isSubset(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(b);
  return a.every((tok) => set.has(tok));
}

/** Case- and whitespace-insensitive identity for "the exact same name": the
 *  display name (person name, company as fallback), lower-cased and with runs
 *  of whitespace collapsed. Empty when the card is nameless. */
function nameKey(c: {
  firstName: string;
  lastName: string;
  company?: string;
}): string {
  return displayName(c).toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

/** Whether two cards' names could belong to the same person: equal, one
 *  extending the other ("Andreas" ⊂ "Andreas Andersson"), or either side
 *  nameless. Outright different names block a silent merge even when a phone
 *  matches — that pair becomes a conflict to confirm instead. */
function namesCompatible(existing: Contact, draft: ImportedContact): boolean {
  const a = personTokens(existing.firstName, existing.lastName);
  const b = personTokens(draft.firstName, draft.lastName);
  if (a.length === 0 || b.length === 0) return true;
  return isSubset(a, b) || isSubset(b, a);
}

/** Whether an existing card and a draft share any phone number or email. */
function sharesMethod(existing: Contact, draft: ImportedContact): boolean {
  if (
    draft.phones.some((p) => existing.phones.some((q) => phonesMatch(p, q)))
  ) {
    return true;
  }
  const emails = new Set(
    existing.emails.map((e) => emailKey(e.value)).filter(Boolean),
  );
  return draft.emails.some((e) => emails.has(emailKey(e.value)));
}

/** Triage a batch of imported drafts against the existing (un-archived)
 *  contacts: shared phone/email → merge (silently when the names agree,
 *  as a conflict to confirm when they don't); exact same name → conflict;
 *  otherwise a new card. Each draft matches at most one target. */
export function planImport(
  existing: readonly Contact[],
  drafts: readonly ImportedContact[],
): ImportPlan {
  const live = existing.filter((c) => !c.archived);
  const plan: ImportPlan = { additions: [], merges: [], conflicts: [] };
  for (const draft of drafts) {
    const byMethod = live.find((c) => sharesMethod(c, draft));
    if (byMethod) {
      if (namesCompatible(byMethod, draft)) {
        plan.merges.push({ targetId: byMethod.id, draft });
      } else {
        plan.conflicts.push(conflict(byMethod, draft));
      }
      continue;
    }
    const key = nameKey(draft);
    const byName = key ? live.find((c) => nameKey(c) === key) : undefined;
    if (byName) plan.conflicts.push(conflict(byName, draft));
    else plan.additions.push(draft);
  }
  return plan;
}

function conflict(target: Contact, draft: ImportedContact): ImportConflict {
  return {
    targetId: target.id,
    targetName: displayName(target),
    draftName: displayName(draft),
    draft,
  };
}

/** Fold an imported draft into an existing card, adding only what's missing:
 *  a more precise name upgrades the stored one, empty fields fill in, and new
 *  phones/emails/addresses/dates/attachments append (deduped against what the
 *  card already holds). Never removes or overwrites existing data. `mint`
 *  supplies ids for the appended rows (the store's `freshId`). */
export function mergeContactDraft(
  existing: Contact,
  draft: ImportedContact,
  mint: (prefix: string) => string,
): Contact {
  const next: Contact = { ...existing };

  // Name: adopt the draft's when it's strictly more precise — the existing
  // tokens all appear in the draft's longer name — or the card is nameless.
  const have = personTokens(next.firstName, next.lastName);
  const incoming = personTokens(draft.firstName, draft.lastName);
  if (
    incoming.length > 0 &&
    (have.length === 0 ||
      (isSubset(have, incoming) && incoming.length > have.length))
  ) {
    next.firstName = draft.firstName;
    next.lastName = draft.lastName;
  }

  if (!next.company?.trim() && draft.company?.trim()) {
    next.company = draft.company;
  }
  // Only a card with no person name can *become* a company — a merge never
  // reshapes a person's card into an organisation.
  if (
    draft.isCompany &&
    !next.isCompany &&
    !next.firstName.trim() &&
    !next.lastName.trim()
  ) {
    next.isCompany = true;
  }
  if (!next.homepage?.trim() && draft.homepage?.trim()) {
    next.homepage = draft.homepage;
  }
  if (!next.birthday?.trim() && draft.birthday?.trim()) {
    next.birthday = draft.birthday;
  }
  const draftNotes = draft.notes?.trim();
  if (draftNotes) {
    const haveNotes = next.notes?.trim();
    if (!haveNotes) next.notes = draftNotes;
    else if (!haveNotes.includes(draftNotes)) {
      next.notes = `${haveNotes}\n${draftNotes}`;
    }
  }

  const phones = [...next.phones];
  for (const p of draft.phones) {
    if (!digitsOnly(p.value)) continue;
    if (phones.some((q) => phonesMatch(q, p))) continue;
    phones.push({ ...p, id: mint("phone") });
  }
  next.phones = phones;

  const emails = [...next.emails];
  const seenEmails = new Set(emails.map((e) => emailKey(e.value)));
  for (const e of draft.emails) {
    const key = emailKey(e.value);
    if (!key || seenEmails.has(key)) continue;
    seenEmails.add(key);
    emails.push({ ...e, id: mint("email") });
  }
  next.emails = emails;

  const addressKey = (a: { street?: string; zip?: string; city?: string }) =>
    [a.street, a.zip, a.city]
      .map((part) => (part ?? "").trim().toLowerCase())
      .join("|");
  const addresses = [...next.addresses];
  const seenAddresses = new Set(addresses.map(addressKey));
  for (const a of draft.addresses) {
    const key = addressKey(a);
    if (seenAddresses.has(key)) continue;
    seenAddresses.add(key);
    addresses.push({ ...a, id: mint("address") });
  }
  next.addresses = addresses;

  const dateKey = (d: { label?: string; date: string }) =>
    `${(d.label ?? "").trim().toLowerCase()}|${d.date.trim()}`;
  const dates = [...next.importantDates];
  const seenDates = new Set(dates.map(dateKey));
  for (const d of draft.importantDates) {
    const key = dateKey(d);
    if (seenDates.has(key)) continue;
    seenDates.add(key);
    dates.push({ ...d, id: mint("date") });
  }
  next.importantDates = dates;

  // A photo only lands on a card that has none — the user's chosen face wins.
  if (draft.photo && !(next.photos && next.photos.length > 0)) {
    next.photos = [{ id: mint("photo"), photo: draft.photo }];
  }

  if (draft.attachments && draft.attachments.length > 0) {
    const attachKey = (a: { name: string; size?: number }) =>
      `${a.name}|${a.size ?? ""}`;
    const attachments = [...(next.attachments ?? [])];
    const seenAttachments = new Set(attachments.map(attachKey));
    for (const a of draft.attachments) {
      const key = attachKey(a);
      if (seenAttachments.has(key)) continue;
      seenAttachments.add(key);
      attachments.push({ ...a, id: mint("attach") });
    }
    next.attachments = attachments;
  }

  if (draft.ice) next.ice = true;

  return next;
}
