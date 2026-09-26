// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The working half of the demo address book: the team at the owner's
// employer (Larkline, a small software company), two freelance clients in a
// subfolder, and the previous job's folder, archived whole. See `demoData.ts`
// for the roster overview and `demoSpec.ts` for the authoring shape.

import type { DemoContactSpec } from "./demoSpec.ts";

/** Work — the team. */
export const DEMO_WORK: DemoContactSpec[] = [
  {
    slug: "aisha",
    first: "Aisha",
    last: "Karim",
    company: "Larkline",
    relation: "colleague",
    phones: [["+1 503 555 0191", "work", "primary"]],
    emails: [["aisha@larkline.example", "work"]],
    notes: "My manager. 1:1s on Thursdays — bring the list, she reads it.",
    folder: "work",
  },
  {
    slug: "ben",
    first: "Ben",
    last: "Sato",
    company: "Larkline",
    relation: "colleague",
    phones: [
      ["+1 503 555 0192", "work", "primary"],
      ["+1 503 555 0137", "private"],
    ],
    emails: [["ben@larkline.example", "work"]],
    notes: "On-call partner. We swap pager weeks; he owes me Thanksgiving.",
    folder: "work",
  },
  {
    slug: "carla",
    first: "Carla",
    last: "Mendes",
    company: "Larkline",
    relation: "colleague",
    phones: [["+1 503 555 0193", "work", "primary"]],
    emails: [["carla@larkline.example", "work"]],
    notes: "Staff engineer. Knows why the billing service is like that.",
    folder: "work",
  },
  {
    slug: "tom",
    first: "Tom",
    last: "Reilly",
    company: "Larkline",
    relation: "colleague",
    phones: [["+1 503 555 0194", "work", "primary"]],
    emails: [["tom@larkline.example", "work"]],
    notes: "Designer. Wants sketches, not tickets.",
    folder: "work",
  },
];

/** Work ▸ Clients — the freelance side. */
export const DEMO_CLIENTS: DemoContactSpec[] = [
  {
    slug: "diane",
    first: "Diane",
    last: "Kessler",
    company: "Kessler Print Co.",
    relation: "business",
    phones: [["+1 360 555 0126", "work", "primary"]],
    emails: [["diane@kesslerprint.example", "work"]],
    addresses: [
      {
        label: "Shop",
        street: "410 Main St",
        city: "Vancouver, WA 98660",
      },
    ],
    notes: "Client — the order tracker. Net 30, pays in ten. Prefers a call.",
    folder: "clients",
  },
  {
    slug: "omar",
    first: "Omar",
    last: "Haddad",
    company: "Haddad Freight",
    relation: "business",
    phones: [["+1 503 555 0198", "work", "primary"]],
    emails: [["omar@haddadfreight.example", "work"]],
    notes: "Client — the routing app. Demo every other Friday at two.",
    folder: "clients",
  },
];

/** The previous job's folder — archived whole, as one does on leaving. */
export const DEMO_OLD_JOB: DemoContactSpec[] = [
  {
    slug: "frank",
    first: "Frank",
    last: "Weber",
    company: "Tidewater Systems",
    relation: "colleague",
    phones: [["+1 206 555 0141", "work", "primary"]],
    emails: [["frank@tidewater.example", "work"]],
    notes: "First boss. Taught me to write the test first.",
    folder: "oldjob",
    archived: true,
  },
  {
    slug: "annika",
    first: "Annika",
    last: "Holm",
    company: "Tidewater Systems",
    relation: "colleague",
    phones: [["+1 206 555 0144", "work", "primary"]],
    emails: [["annika@tidewater.example", "work"]],
    notes: "Ran the release train. Never once late.",
    folder: "oldjob",
    archived: true,
  },
  {
    slug: "jens",
    first: "Jens",
    last: "Adler",
    company: "Tidewater Systems",
    relation: "colleague",
    phones: [["+1 206 555 0146", "work", "primary"]],
    notes: "Ops. Hikes every weekend; still sends trail photos.",
    folder: "oldjob",
    archived: true,
  },
];
