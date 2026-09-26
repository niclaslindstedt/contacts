// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The declarative shape a demo-data contact is authored in. The demo roster
// (see `demoPeople.ts` / `demoWork.ts` / `demoPlaces.ts`) is written as terse
// specs — phone numbers the way a person would type them, tuples for the
// repeated rows — and `demoData.ts` expands each spec into a real `Contact`
// with stable ids. Keeping the authoring shape small is what keeps fifty
// hand-written cards readable.

import type { AutoArchiveAction, ContactMethodKind } from "../types.ts";

/** A day the demo computes from the moment it opens, so the book never ages:
 *  `{ inDays: 9 }` is nine days from now; with a `year`, it is that day's
 *  month and day in the given year (a birthday that is always nine days off).
 *  A plain string is a fixed `YYYY-MM-DD` (or yearless `MM-DD`). */
export type DemoDay = string | { inDays: number; year?: number };

/** One phone as typed: the number (international `+…` format so it renders the
 *  same regardless of the user's home-country setting), the private/work kind,
 *  and an optional `"primary"` flag for the number to reach them on. */
export type DemoPhoneSpec = readonly [string, ContactMethodKind?, "primary"?];

/** One email as typed: the address and the private/work kind. */
export type DemoEmailSpec = readonly [string, ContactMethodKind?];

/** One postal address; any part may be absent, like the real edit form. A US
 *  address keeps its ZIP in `city` ("Portland, OR 97214"), the way it is
 *  written, because the app prints a separate ZIP before the city. */
export type DemoAddressSpec = {
  label?: string;
  street?: string;
  zip?: string;
  city?: string;
};

/** One important date beyond the birthday: [label, day]. */
export type DemoDateSpec = readonly [string, DemoDay];

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
  "family" | "friends" | "hackerspace" | "work" | "clients" | "home" | "oldjob";

/** One demo contact, authored declaratively. `slug` keys every generated id
 *  (`demo-c-<slug>`, `demo-<slug>-ph1`, …) and the card's portrait in
 *  `demoPhotos.ts`, so the built document is stable across reloads.
 *  `favorite` is the card's position on the Favorites page — presence means
 *  starred. `relation` is a built-in key ("friend") or a custom label.
 *  `autoArchive` is [day, action]. */
export type DemoContactSpec = {
  slug: string;
  first?: string;
  last?: string;
  company?: string;
  isCompany?: boolean;
  homepage?: string;
  relation?: string;
  tags?: readonly string[];
  phones?: readonly DemoPhoneSpec[];
  emails?: readonly DemoEmailSpec[];
  addresses?: readonly DemoAddressSpec[];
  birthday?: DemoDay;
  dates?: readonly DemoDateSpec[];
  notes?: string;
  folder?: DemoFolderKey;
  glyph?: string;
  color?: string;
  ice?: true;
  favorite?: number;
  archived?: true;
  autoArchive?: readonly [DemoDay, AutoArchiveAction];
  attachments?: readonly DemoAttachmentSpec[];
};
