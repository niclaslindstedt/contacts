// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  compileQuery,
  clipAround,
  type MatchRange,
} from "@niclaslindstedt/oss-framework/search";

import { formatAddress } from "./address.ts";
import type { AppData } from "./types.ts";
import { displayName } from "./types.ts";

// The app side of the search seam: the framework owns the matcher (the query
// language, per-string matching, scoring, highlighting) and the overlay
// chrome; this file owns the *corpus* — what gets indexed and how the hits are
// grouped (per contact). A card contributes its display name, company, every
// phone number and email address, and its notes (clipped to a snippet).

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
export function runSearch(data: AppData, raw: string): SearchOutcome {
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
    for (const p of contact.phones) tryField(`phone-${p.id}`, p.value);
    for (const e of contact.emails) tryField(`email-${e.id}`, e.value);
    tryField("address", formatAddress(contact));

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
