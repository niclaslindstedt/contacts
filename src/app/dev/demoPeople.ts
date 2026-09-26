// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The personal half of the demo address book: family, friends near and far,
// and the hackerspace. See `demoData.ts` for whose book this is and why it
// holds what it holds, and `demoSpec.ts` for the authoring shape.
//
// Every number is from a range reserved for fiction — US 555-0100…0199,
// Swedish 070-174 06xx — and every address is invented. The
// notes are the point: each says something the stock address book has no
// field for.

import type { DemoContactSpec } from "./demoSpec.ts";

/** Family — the partner, parents, sister and her husband, a grandmother, a
 *  cousin. The partner and the sister are the emergency contacts. */
export const DEMO_FAMILY: DemoContactSpec[] = [
  {
    slug: "maya",
    first: "Maya",
    last: "Brooks",
    company: "Juniper Street Studio",
    relation: "partner",
    phones: [
      ["+1 503 555 0142", "private", "primary"],
      ["+1 503 555 0187", "work"],
    ],
    emails: [
      ["maya@example.com", "private"],
      ["maya@juniperstreet.example", "work"],
    ],
    addresses: [
      { label: "Home", street: "2417 SE Alder St", city: "Portland, OR 97214" },
    ],
    birthday: "1991-06-14",
    dates: [["Together since", "2016-03-05"]],
    notes: "Standup at 9:30 — text, don't call. Oat milk, no sugar.",
    folder: "family",
    ice: true,
    favorite: 1,
  },
  {
    slug: "carol",
    first: "Carol",
    last: "Harper",
    relation: "family",
    phones: [
      ["+1 541 555 0110", "private", "primary"],
      ["+1 541 555 0129", "private"],
    ],
    emails: [["carol.harper@example.com", "private"]],
    addresses: [
      { label: "Home", street: "88 Willow Ln", city: "Eugene, OR 97405" },
    ],
    birthday: "1958-11-02",
    notes: "Mom. Answers the landline, never the cell. Sundays after four.",
    folder: "family",
    favorite: 3,
  },
  {
    slug: "walt",
    first: "Walt",
    last: "Harper",
    relation: "family",
    phones: [["+1 541 555 0111", "private", "primary"]],
    emails: [["walt.harper@example.com", "private"]],
    addresses: [
      { label: "Home", street: "88 Willow Ln", city: "Eugene, OR 97405" },
    ],
    birthday: "1956-08-21",
    notes: "Dad. Ham radio — still solders his own antennas. Budget an hour.",
    folder: "family",
  },
  {
    slug: "nora",
    first: "Nora",
    last: "Diaz",
    relation: "family",
    phones: [["+1 503 555 0133", "private", "primary"]],
    emails: [["nora.diaz@example.com", "private"]],
    birthday: "1987-02-09",
    notes: "Sister. Has our spare key. Kids: Mateo (9) and Ava (6).",
    folder: "family",
    ice: true,
    favorite: 6,
  },
  {
    slug: "marco",
    first: "Marco",
    last: "Diaz",
    relation: "family",
    phones: [["+1 503 555 0134", "private", "primary"]],
    emails: [["marco.diaz@example.com", "private"]],
    notes: "Smokes a brisket every Fourth of July. Bring ice.",
    folder: "family",
  },
  {
    slug: "june",
    first: "June",
    last: "Harper",
    relation: "Grandma",
    phones: [["+1 520 555 0158", "private", "primary"]],
    addresses: [
      { label: "Home", street: "1210 E Mabel St", city: "Tucson, AZ 85719" },
    ],
    birthday: "1934-04-30",
    notes: "Save her a crossword clue. Call before 8pm her time.",
    folder: "family",
  },
  {
    slug: "ellie",
    first: "Ellie",
    last: "Harper",
    relation: "Cousin",
    phones: [["+1 541 555 0176", "private", "primary"]],
    emails: [["ellie.h@example.com", "private"]],
    notes: "Studying robotics. Wants 3D printing lessons at the hackerspace.",
    folder: "family",
  },
];

/** Friends — the ones nearby and two abroad. Priya's card is the one the
 *  store's first screenshot opens: every section it carries fits a phone. */
export const DEMO_FRIENDS: DemoContactSpec[] = [
  {
    slug: "priya",
    first: "Priya",
    last: "Raman",
    company: "Ferrous Robotics",
    tags: ["Climbing", "Hackerspace"],
    phones: [["+1 503 555 0163", "private", "primary"]],
    // Always nine days off — the countdown the first frame shows.
    birthday: { inDays: 9, year: 1992 },
    notes:
      "Hackathon friend. Best belayer I know. Still has my soldering iron.",
    folder: "friends",
    favorite: 2,
  },
  {
    slug: "theo",
    first: "Theo",
    last: "Novak",
    relation: "friend",
    tags: ["Tabletop"],
    phones: [["+1 503 555 0171", "private", "primary"]],
    emails: [["theo.novak@example.com", "private"]],
    birthday: "1989-10-27",
    notes: "Runs our Thursday campaign. Has never once made a dragon easy.",
    folder: "friends",
    favorite: 4,
  },
  {
    slug: "rosa",
    first: "Rosa",
    last: "Delgado",
    relation: "friend",
    phones: [["+1 503 555 0119", "private", "primary"]],
    emails: [["rosa.d@example.com", "private"]],
    notes: "Owns a truck. Will help you move for pizza.",
    folder: "friends",
    favorite: 7,
  },
  {
    slug: "sam",
    first: "Sam",
    last: "Okafor",
    relation: "friend",
    tags: ["Band"],
    phones: [["+1 971 555 0122", "private", "primary"]],
    emails: [["sam.okafor@example.com", "private"]],
    notes: "Bass. Rehearsal Wednesdays in his garage — earplugs live there.",
    folder: "friends",
  },
  {
    slug: "ollie",
    first: "Ollie",
    last: "Whitfield",
    relation: "friend",
    phones: [["+1 503 555 0132", "private", "primary"]],
    emails: [["ollie@whitfield.example", "private"]],
    birthday: "1990-12-03",
    notes:
      "Moved to London, kept his US number. Eight hours ahead — text first.",
    folder: "friends",
  },
  {
    slug: "erik",
    first: "Erik",
    last: "Lindqvist",
    relation: "friend",
    phones: [["+46 70 174 06 42", "private", "primary"]],
    emails: [["erik.lindqvist@example.com", "private"]],
    notes: "Stockholm. Knows every sauna in town, and ranks them.",
    folder: "friends",
  },
  {
    slug: "jess",
    first: "Jess",
    last: "Moreno",
    relation: "friend",
    phones: [["+1 503 555 0148", "private", "primary"]],
    emails: [["jess.moreno@example.com", "private"]],
    notes: "Cat-sits Kernel when we travel. Paid in sourdough.",
    folder: "friends",
    favorite: 5,
  },
  {
    slug: "leo",
    first: "Leo",
    last: "Park",
    relation: "friend",
    tags: ["Running"],
    phones: [["+1 503 555 0151", "private", "primary"]],
    notes: "Trail runs Saturdays at 7. He is always early.",
    folder: "friends",
    favorite: 8,
  },
  {
    slug: "hana",
    first: "Hana",
    last: "Kim",
    relation: "friend",
    phones: [["+1 503 555 0166", "private", "primary"]],
    emails: [["hana.kim@example.com", "private"]],
    notes: "Hosts book club. Picks the long ones on purpose.",
    folder: "friends",
  },
];

/** The hackerspace — the people (and the one PDF) the store's search frame
 *  finds with `/solder|laser|3d print/`. */
export const DEMO_HACKERSPACE: DemoContactSpec[] = [
  {
    slug: "dev",
    first: "Dev",
    last: "Malhotra",
    relation: "friend",
    tags: ["Hackerspace"],
    phones: [["+1 503 555 0172", "private", "primary"]],
    emails: [["dev@malhotra.example", "private"]],
    notes: "Runs the laser cutter on Tuesdays. Bring your own plywood.",
    folder: "hackerspace",
  },
  {
    slug: "greta",
    first: "Greta",
    last: "Sorensen",
    relation: "friend",
    tags: ["Hackerspace"],
    phones: [["+1 503 555 0174", "private", "primary"]],
    notes: "Keeps the 3D printers alive. Ask before any print over six hours.",
    folder: "hackerspace",
  },
  {
    slug: "marcus",
    first: "Marcus",
    last: "Bell",
    relation: "friend",
    tags: ["Hackerspace"],
    phones: [["+1 971 555 0181", "private", "primary"]],
    emails: [["marcus.bell@example.com", "private"]],
    notes: "Taught me to solder. Reworks chips smaller than a grain of rice.",
    folder: "hackerspace",
  },
  {
    slug: "ines",
    first: "Ines",
    last: "Carvalho",
    relation: "friend",
    tags: ["Hackerspace"],
    phones: [["+1 503 555 0183", "private", "primary"]],
    notes: "Keyholder. The door code changes monthly — she has it.",
    folder: "hackerspace",
  },
];
