// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The contact-flavoured glyph catalogue. The framework ships a neutral,
// checklist-era glyph set (`GLYPH_PATHS`); for an address book those marks read
// oddly ("why is there a dumbbell?"). This module keeps the domain choice in
// the app ("store stays in the app"): it curates the marks that answer the two
// questions you actually ask of a contact — *what relation is this?* (partner,
// family, friend, favourite…) and *what kind of place is this?* (work, bank,
// doctor, school, shop, café…) — reusing the framework paths where they fit and
// adding the handful the neutral set lacks.
//
// Pure data + a resolver — no React here, so the ordering and coverage are
// unit-testable in node (see `tests/contactGlyphs_test.ts`). The renderer and
// picker that draw these live in `ContactGlyph.tsx`.

import { GLYPH_PATHS } from "@niclaslindstedt/oss-framework/glyphs";

// Inner SVG for the contact-specific marks the framework's neutral catalogue
// doesn't carry. Traced on Lucide's 24×24 grid to match the framework family's
// stroke weight, so an app mark and a framework mark sit together evenly.
const APP_GLYPH_PATHS: Record<string, string> = {
  // A single person — a friend or an individual contact.
  person:
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  // An office block — a company or workplace.
  building:
    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  // A columned facade — a bank or a public institution.
  landmark:
    '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  // A medical cross — a doctor, dentist, clinic, or pharmacy.
  cross:
    '<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/>',
  // A mortar board — a school, university, or teacher.
  "graduation-cap":
    '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  // A storefront — a shop or a local business.
  store:
    '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
  // A knife and fork — a restaurant.
  utensils:
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  // A handset — a phone-first service or business.
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
};

/** The render map: every mark this app can *draw*. It's a superset of the
 *  picker set so a card that already carries any framework glyph — or an app
 *  one — still renders, even if the picker no longer offers it. */
export const CONTACT_GLYPH_PATHS: Record<string, string> = {
  ...GLYPH_PATHS,
  ...APP_GLYPH_PATHS,
};

/** The ordered set the picker *offers*, grouped the way you reach for them:
 *  relations first (who is this to me?), then the kinds of places and
 *  organisations an address book fills up with. */
export const CONTACT_GLYPH_NAMES: readonly string[] = [
  // Relations.
  "heart", // partner / spouse
  "users", // family / a group
  "person", // a friend / an individual
  "home", // household
  "star", // favourite / VIP
  "gift", // birthday / celebration
  // Places & organisations.
  "briefcase", // work / a colleague
  "building", // a company / office
  "landmark", // a bank / institution
  "wallet", // finances / an accountant
  "cross", // doctor / dentist / pharmacy
  "graduation-cap", // school / university
  "book", // a library / studies
  "store", // a shop
  "cart", // groceries
  "utensils", // a restaurant
  "coffee", // a café
  "dumbbell", // a gym
  "plane", // travel / an airline
  "car", // a garage / auto
  "phone", // a phone-first service
  "music", // music / a venue
  "leaf", // garden / outdoors
];

/** The inner SVG for a glyph name, or `undefined` when the name isn't one this
 *  app can draw (the caller renders the neutral person mark instead). */
export function contactGlyphPath(
  name: string | null | undefined,
): string | undefined {
  if (!name) return undefined;
  return CONTACT_GLYPH_PATHS[name];
}
