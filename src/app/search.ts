// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  compileQuery,
  clipAround,
  type MatchRange,
} from "@niclaslindstedt/oss-framework/search";

import { formatAddress } from "./address.ts";
import { attachmentList } from "./attachments.ts";
import { contactTags } from "./tags.ts";
import type { AppData } from "./types.ts";
import { displayName } from "./types.ts";

// The app side of the search seam: the framework owns the matcher (the query
// language, per-string matching, scoring, highlighting) and the overlay
// chrome; this file owns the *corpus* — what gets indexed and how the hits are
// grouped (per contact). A card contributes **everything textual it carries**:
// its display name, company, homepage, every phone number and email address,
// each address (title + parts), the birthday and each important date, its
// relationship and every tag, every attachment's file name and description,
// and its notes (long texts clipped to a snippet) — so quick find surfaces a
// card no matter which corner of it holds the term.
//
// The relationship is stored as a key for the five built-ins ("family", …) but
// shown as a localized label, so the corpus indexes the *label*: the overlay
// (which has `t`) passes a resolver; a bare call (e.g. a test) falls back to the
// stored value verbatim.

/** How to render a stored relationship value as the searchable text — the
 *  localized label for a built-in key, the verbatim text for a custom one. */
export type SearchOptions = {
  relationLabel?: (value: string) => string;
};

/** One matched field within a contact group. */
export type FieldHit = {
  /** Stable key for rendering ("phone-<id>", "email-<id>", "company"…). */
  key: string;
  /** The matched text as shown (a phone number, an email, a snippet). */
  text: string;
  ranges: MatchRange[];
};

/** All matches within one contact, ready to render as a group. */
export type ContactResult = {
  contactId: string;
  title: string;
  /** Ranges within the display name when it matched, else null. */
  titleRanges: MatchRange[] | null;
  fields: FieldHit[];
  /** Best single-match score in the group — drives result ordering. */
  score: number;
};

export type SearchOutcome = {
  results: ContactResult[];
  invalidRegex: boolean;
};

/**
 * Run `raw` against the document, grouping the hits per contact. A name hit
 * fills `titleRanges` (and surfaces the card a little higher); field hits fill
 * `fields`. Archived contacts are skipped — a result navigates to a live card.
 */
export function runSearch(
  data: AppData,
  raw: string,
  options: SearchOptions = {},
): SearchOutcome {
  const q = compileQuery(raw);
  if (q.isEmpty) return { results: [], invalidRegex: false };
  if (q.invalidRegex) return { results: [], invalidRegex: true };

  const results: ContactResult[] = [];
  for (const contact of data.contacts) {
    if (contact.archived) continue;

    const title = displayName(contact);
    let titleRanges: MatchRange[] | null = null;
    let score = 0;
    const nameMatch = title ? q.match(title) : null;
    if (nameMatch) {
      titleRanges = nameMatch.ranges;
      // A name hit is worth extra so the card surfaces near the top.
      score = Math.max(score, nameMatch.score + 50);
    }

    const fields: FieldHit[] = [];
    const tryField = (key: string, text: string | undefined) => {
      if (!text) return;
      const m = q.match(text);
      if (!m) return;
      fields.push({ key, text, ranges: m.ranges });
      score = Math.max(score, m.score);
    };

    tryField("company", contact.company);
    tryField("homepage", contact.homepage);
    tryField("birthday", contact.birthday);
    for (const p of contact.phones) tryField(`phone-${p.id}`, p.value);
    for (const e of contact.emails) tryField(`email-${e.id}`, e.value);
    for (const a of contact.addresses) {
      tryField(
        `address-${a.id}`,
        [a.label?.trim(), formatAddress(a)].filter(Boolean).join(" "),
      );
    }
    for (const d of contact.importantDates) {
      tryField(
        `date-${d.id}`,
        [d.label?.trim(), d.date].filter(Boolean).join(" "),
      );
    }

    // Relationship: index the label the read view shows — the localized name of
    // a built-in ("family" → "Family" / "Familj"), or a custom value verbatim.
    if (contact.relation) {
      const resolve = options.relationLabel ?? ((v) => v);
      tryField("relation", resolve(contact.relation));
    }

    // Tags: each free-form tag indexes on its own, so "boat club" surfaces the
    // card no matter how many other tags it carries.
    contactTags(contact).forEach((tag, i) => tryField(`tag-${i}`, tag));

    // Attachments: the file name and its free-text description both index, so
    // "menu.pdf" and "lunch menu" alike surface the card carrying the file.
    for (const att of attachmentList(contact)) {
      tryField(`attachment-${att.id}`, att.name);
      if (att.description) {
        const m = q.match(att.description);
        if (m) {
          const clip = clipAround(att.description, m.ranges);
          fields.push({
            key: `attachment-desc-${att.id}`,
            text: clip.text,
            ranges: clip.ranges,
          });
          score = Math.max(score, m.score);
        }
      }
    }

    // Notes can be long — clip the hit to a focused window.
    if (contact.notes) {
      const m = q.match(contact.notes);
      if (m) {
        const clip = clipAround(contact.notes, m.ranges);
        fields.push({ key: "notes", text: clip.text, ranges: clip.ranges });
        score = Math.max(score, m.score);
      }
    }

    if (titleRanges || fields.length > 0) {
      results.push({
        contactId: contact.id,
        title: title || contact.emails[0]?.value || contact.id,
        titleRanges,
        fields,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return { results, invalidRegex: false };
}
