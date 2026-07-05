// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The declarative shape a demo-data contact is authored in. The demo roster
// (see `demoPeople.ts` / `demoWork.ts` / `demoPlaces.ts`) is written as terse
// specs — phone numbers the way a person would type them, tuples for the
// repeated rows — and `demoData.ts` expands each spec into a real `Contact`
// with stable ids. Keeping the authoring shape small is what lets a hundred
// hand-written cards stay readable (and under the file-size cap).

import type { AutoArchiveAction, ContactMethodKind } from "../types.ts";

/** One phone as typed: the number (international `+…` format so it renders the
 *  same regardless of the user's home-country setting), the private/work kind,
 *  and an optional `"primary"` flag for the number to reach them on. */
export type DemoPhoneSpec = readonly [string, ContactMethodKind?, "primary"?];

/** One email as typed: the address and the private/work kind. */
export type DemoEmailSpec = readonly [string, ContactMethodKind?];

/** One postal address; any part may be absent, like the real edit form. */
export type DemoAddressSpec = {
  label?: string;
  street?: string;
  zip?: string;
  city?: string;
};

/** One important date beyond the birthday: [label, date]. The date is a full
 *  ISO `YYYY-MM-DD` when the year is known, or a bare `MM-DD` when it isn't
 *  (name days are yearless; anniversaries carry their year). */
export type DemoDateSpec = readonly [string, string];

/** One attached file — a real (tiny) document embedded as a data URI. */
export type DemoAttachmentSpec = {
  name: string;
  mime: string;
  size?: number;
  description?: string;
  data: string;
};

/** The folder a card files under; absent means the menu root. Keys map onto
 *  the demo folder tree built in `demoData.ts`. */
export type DemoFolderKey =
  | "family"
  | "inlaws"
  | "friends"
  | "work"
  | "clients"
  | "school"
  | "services"
  | "oldjob";

/** One demo contact, authored declaratively. `slug` keys every generated id
 *  (`demo-c-<slug>`, `demo-<slug>-ph1`, …) so the built document is stable
 *  across reloads. `favorite` is the card's position on the Favorites page —
 *  presence means starred. `autoArchive` is [date, action]. */
export type DemoContactSpec = {
  slug: string;
  first?: string;
  last?: string;
  company?: string;
  isCompany?: boolean;
  homepage?: string;
  phones?: readonly DemoPhoneSpec[];
  emails?: readonly DemoEmailSpec[];
  addresses?: readonly DemoAddressSpec[];
  birthday?: string;
  dates?: readonly DemoDateSpec[];
  notes?: string;
  folder?: DemoFolderKey;
  glyph?: string;
  color?: string;
  ice?: true;
  favorite?: number;
  archived?: true;
  autoArchive?: readonly [string, AutoArchiveAction];
  attachments?: readonly DemoAttachmentSpec[];
};
