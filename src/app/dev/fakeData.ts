// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The developer "Fake data" sample document. A pure builder — it returns a
// fresh `AppData` each call, so edits made during a fake-data session never
// mutate this template. Loaded into the store in-memory only (see
// `useContactStore`'s fake-seed path) and never persisted, so a page reload
// always drops back to the user's real address book.
//
// Two jobs:
//
//   1. The Developer tab's "Fake data" toggle boots a small, friendly sample
//      that still covers the shapes a card can take (`"sample"`).
//   2. `VITE_SEED` boots the dev server pre-loaded with a lot of *varied* test
//      data — a big deterministic spread designed to shake out edge cases in
//      the list, search, sort, export, and formatters (`"large"` or a number).
//
// The dataset leans deliberately into the awkward: nameless (company-only)
// cards, first/last-name-only cards, very long strings, unicode / emoji / RTL,
// many phones and emails, leap-day and far-past/future birthdays, and every
// phone / postal-code style the Format tab can render. Everything here is
// deterministic (no `Math.random`, no clock) so the same seed always builds
// the same document — reproducible bug reports, stable tests.

import type { AppData, Contact, Email, Folder, Phone } from "../types.ts";

/** How much fake data to build: the curated `"sample"` set, or that set plus
 *  enough generated cards to reach roughly N contacts (a number), with
 *  `"large"` a named shorthand for a stress-test count. */
export type FakeSeedSize = "sample" | number;

/** The parsed intent of the `VITE_SEED` build-time variable. */
export type FakeSeedConfig = {
  active: boolean;
  size: FakeSeedSize;
};

// The count `VITE_SEED=large` expands to — big enough to stress the virtualised
// list and the search index without being so large that a dev reload crawls.
export const LARGE_SEED_COUNT = 250;

// A 1×1 transparent PNG — a valid `photo` data URI without shipping a real
// image. Enough to exercise the avatar's photo path (vs. the glyph fallback).
const PIXEL_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Glyph names the app can actually draw (a subset of `CONTACT_GLYPH_NAMES`),
// and a set of accent colours — cycled through the generated cards so the menu
// shows a spread of styled avatars.
const GLYPHS = [
  "heart",
  "users",
  "person",
  "star",
  "gift",
  "briefcase",
  "building",
  "cross",
  "graduation-cap",
  "store",
  "coffee",
  "plane",
] as const;
const COLORS = [
  "#86efac",
  "#fca5a5",
  "#93c5fd",
  "#fcd34d",
  "#c4b5fd",
  "#5eead4",
  "#f9a8d4",
  "#fdba74",
] as const;

// Deterministic name pools for the generated bulk. Mixed scripts on purpose so
// the sort collation and the avatar monogram meet non-latin input.
const FIRST_NAMES = [
  "Ada",
  "Bjørn",
  "Chen",
  "Dmitri",
  "Élodie",
  "Farah",
  "Gustavo",
  "Hanne",
  "Ισμήνη",
  "Jamal",
  "Květa",
  "Liang",
  "Māra",
  "Nedelko",
  "Oluwaseun",
  "Priya",
  "Qamar",
  "Rún",
  "Sofía",
  "Thabo",
  "Uma",
  "Vito",
  "Wenjun",
  "Xóchitl",
  "Yusuf",
  "Zheng",
];
const LAST_NAMES = [
  "Andersson",
  "Bauer",
  "Chaudhry",
  "Diallo",
  "Eriksson",
  "Fitzgerald",
  "García",
  "Håkansson",
  "Ivanović",
  "Johansson",
  "Kowalski",
  "Lindqvist",
  "Müller",
  "Nakamura",
  "O'Brien",
  "Petrov",
  "Quintero",
  "Rossi",
  "Sørensen",
  "Tanaka",
];

// Curated folder ids — stable so the sample reads the same every build.
const FLD_FAMILY = "seed-fld-family";
const FLD_WORK = "seed-fld-work";
const FLD_EMPTY = "seed-fld-empty";
const FLD_ARCHIVED = "seed-fld-archived";

const CURATED_FOLDERS: Folder[] = [
  { id: FLD_FAMILY, name: "Family" },
  { id: FLD_WORK, name: "Work" },
  // An empty folder — the side menu's zero-contact row.
  { id: FLD_EMPTY, name: "Empty folder" },
  // An archived folder (and the contacts it holds) — exercises the Archive
  // screen and its counters.
  { id: FLD_ARCHIVED, name: "Old colleagues", archived: true },
];

// A little id sequencer so every field row / card gets a unique, legible id
// within one built document. Base-36 keeps the ids short.
function sequencer(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${(++n).toString(36)}`;
}

/** Build the curated edge-case cards. Each one is a deliberately awkward shape
 *  the real UI has to survive; the comments say which. */
function curatedContacts(): Contact[] {
  const ph = sequencer("seed-ph");
  const em = sequencer("seed-em");
  const phone = (value: string, label?: string): Phone => ({
    id: ph(),
    value,
    ...(label ? { label } : {}),
  });
  const email = (value: string, label?: string): Email => ({
    id: em(),
    value,
    ...(label ? { label } : {}),
  });

  return [
    // The fully-loaded card: every field carries something, so the read view,
    // export, and each formatter all have real input.
    {
      id: "seed-c-full",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical Engines Ltd",
      phones: [
        phone("+46 8 123 45 67", "mobile"),
        phone("+44 20 7946 0958", "work"),
      ],
      emails: [
        email("ada@example.com", "personal"),
        email("a.lovelace@analytical.example", "work"),
      ],
      street: "12 Marylebone Rd",
      zip: "12345-6789",
      city: "London",
      birthday: "1815-12-10",
      notes: "First programmer. Prefers letters to phone calls.",
      photo: PIXEL_PHOTO,
      glyph: "star",
      color: "#fcd34d",
      folderId: FLD_FAMILY,
    },
    // Company-only: no first/last name at all — `displayName` must fall back to
    // the company, and the monogram to its first letter.
    {
      id: "seed-c-company",
      firstName: "",
      lastName: "",
      company: "Globex Corporation",
      phones: [phone("+1 (555) 010-0100", "reception")],
      emails: [email("hello@globex.example")],
      city: "Springfield",
      folderId: FLD_WORK,
      glyph: "building",
      color: "#93c5fd",
    },
    // First name only.
    {
      id: "seed-c-firstonly",
      firstName: "Cher",
      lastName: "",
      phones: [phone("555-0142")],
      emails: [],
      folderId: null,
    },
    // Last name only (a formal "Dr. …" with no given name recorded).
    {
      id: "seed-c-lastonly",
      firstName: "",
      lastName: "Nightingale",
      company: "St Thomas' Hospital",
      phones: [],
      emails: [email("ward@example.org", "work")],
      glyph: "cross",
      color: "#fca5a5",
      folderId: FLD_WORK,
    },
    // Very long everything — overflow / truncation / wrapping stress.
    {
      id: "seed-c-long",
      firstName: "Maximilian Alexander Bartholomew",
      lastName: "Featherstonehaugh-Vandermeer",
      company:
        "The Extraordinarily Long Company Name for Testing Layout Overflow, Incorporated",
      phones: [phone("+1 (555) 111-2222", "this is an unusually long label")],
      emails: [
        email(
          "an.extremely.long.email.address.for.wrapping@some.very.long.subdomain.example.com",
        ),
      ],
      street: "1000 Really Long Boulevard of Broken Layouts, Suite 4000",
      zip: "99950",
      city: "A City With A Remarkably Long Name Upon The River",
      notes:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do " +
        "eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim " +
        "ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
        "aliquip ex ea commodo consequat.",
      folderId: null,
      glyph: "briefcase",
      color: "#c4b5fd",
    },
    // Non-latin script + emoji + RTL — collation, monogram, and rendering.
    {
      id: "seed-c-unicode",
      firstName: "日本語",
      lastName: "テスト",
      company: "会社 🏢",
      phones: [phone("+81 3-1234-5678", "携帯")],
      emails: [email("test@example.jp")],
      notes: "Emoji 🎉🚀 and mixed scripts: Ελληνικά, Русский, 中文.",
      folderId: FLD_FAMILY,
      glyph: "gift",
      color: "#f9a8d4",
    },
    {
      id: "seed-c-rtl",
      firstName: "محمد",
      lastName: "الأحمد",
      phones: [phone("+20 2 1234 5678")],
      emails: [email("mohammed@example.eg")],
      city: "القاهرة",
      folderId: null,
    },
    // Many phones and many emails — the field lists at their tallest.
    {
      id: "seed-c-many",
      firstName: "Polly",
      lastName: "Numbers",
      phones: [
        phone("+1 555-0001", "mobile"),
        phone("+1 555-0002", "home"),
        phone("+1 555-0003", "work"),
        phone("+1 555-0004", "fax"),
        phone("+1 555-0005 x1234", "office"),
        phone("1-800-FLOWERS", "vanity"),
        phone("555.0006", "other"),
        phone("+46 70 000 00 07", "sweden"),
      ],
      emails: [
        email("polly1@example.com", "personal"),
        email("polly2@example.com", "work"),
        email("polly3@example.com", "school"),
        email("polly.numbers+tagged@example.com", "tagged"),
        email("p@ex.io"),
        email("polly@subdomain.example.co.uk", "uk"),
      ],
      folderId: FLD_WORK,
      glyph: "person",
      color: "#5eead4",
    },
    // Birthday edge cases: a leap-day, a very old date, and a future one.
    {
      id: "seed-c-leap",
      firstName: "Leap",
      lastName: "Yearsley",
      phones: [],
      emails: [],
      birthday: "2000-02-29",
      notes: "Born on a leap day — only has a 'real' birthday every 4 years.",
      folderId: FLD_FAMILY,
      glyph: "gift",
      color: "#fdba74",
    },
    {
      id: "seed-c-ancient",
      firstName: "Methuselah",
      lastName: "Elder",
      phones: [],
      emails: [],
      birthday: "1900-01-01",
      folderId: null,
    },
    {
      id: "seed-c-future",
      firstName: "Future",
      lastName: "Child",
      phones: [],
      emails: [],
      birthday: "2099-12-31",
      folderId: FLD_FAMILY,
    },
    // Postal-code variety — every `ZipFormat` the Format tab renders.
    {
      id: "seed-c-zip-se",
      firstName: "Sven",
      lastName: "Svensson",
      phones: [phone("+46 8 555 123")],
      emails: [],
      street: "Storgatan 1",
      zip: "11122",
      city: "Stockholm",
      folderId: null,
      glyph: "home",
      color: "#86efac",
    },
    {
      id: "seed-c-zip-us9",
      firstName: "Betty",
      lastName: "Zipcode",
      phones: [],
      emails: [],
      street: "742 Evergreen Terrace",
      zip: "902100000",
      city: "Los Angeles",
      folderId: null,
    },
    // A photo card — exercises the avatar's image path over the glyph fallback.
    {
      id: "seed-c-photo",
      firstName: "Photo",
      lastName: "Person",
      phones: [phone("+1 555-0199", "mobile")],
      emails: [email("photo@example.com")],
      photo: PIXEL_PHOTO,
      folderId: FLD_FAMILY,
    },
    // A wholly blank card — the empty-draft shape the starter document ships,
    // sitting alongside real data.
    {
      id: "seed-c-blank",
      firstName: "",
      lastName: "",
      phones: [],
      emails: [],
      folderId: null,
    },
    // Archived cards: one inside the archived folder, one standalone. Both stay
    // in the document but drop out of the menu (the Archive screen tallies them).
    {
      id: "seed-c-arch-folder",
      firstName: "Former",
      lastName: "Coworker",
      company: "Previous Employer AB",
      phones: [phone("+46 8 555 999")],
      emails: [email("former@old.example")],
      folderId: FLD_ARCHIVED,
      archived: true,
    },
    {
      id: "seed-c-arch-solo",
      firstName: "Archived",
      lastName: "Standalone",
      phones: [],
      emails: [],
      folderId: null,
      archived: true,
    },
  ];
}

// One generated bulk card, derived entirely from its index so the output is
// deterministic. The modulo mix gives a realistic spread: most cards have a
// phone, some an email, a company, an address, or a birthday; a slice are
// archived; each lands in a folder (or the root) round-robin.
function generatedContact(i: number): Contact {
  const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
  const last = LAST_NAMES[(i * 7) % LAST_NAMES.length]!;
  const seq = (i + 1).toString().padStart(4, "0");

  const phones: Phone[] =
    i % 4 === 0
      ? []
      : [
          {
            id: `seed-gph-${seq}`,
            value: `+1 555-${seq}`,
            label: i % 3 === 0 ? "work" : "mobile",
          },
        ];
  const emails: Email[] =
    i % 3 === 0
      ? [
          {
            id: `seed-gem-${seq}`,
            value: `${first.toLowerCase()}.${seq}@example.com`,
          },
        ]
      : [];

  const folderId = i % 5 === 0 ? FLD_FAMILY : i % 5 === 1 ? FLD_WORK : null;

  const contact: Contact = {
    id: `seed-gen-${seq}`,
    firstName: first,
    lastName: last,
    phones,
    emails,
    folderId,
    glyph: GLYPHS[i % GLYPHS.length]!,
    color: COLORS[i % COLORS.length]!,
  };

  if (i % 6 === 0) contact.company = `${last} & Co`;
  if (i % 7 === 0) {
    contact.street = `${100 + i} Test Street`;
    contact.zip = String(10000 + (i % 89999)).padStart(5, "0");
    contact.city = "Testville";
  }
  if (i % 8 === 0) {
    const month = String((i % 12) + 1).padStart(2, "0");
    const day = String((i % 28) + 1).padStart(2, "0");
    contact.birthday = `19${String(50 + (i % 50)).padStart(2, "0")}-${month}-${day}`;
  }
  // A minority are archived so the Archive screen has bulk to page through.
  if (i % 11 === 0) contact.archived = true;

  return contact;
}

/** Normalise a raw `VITE_SEED` value into an intent. Absent / falsy → inactive;
 *  `large`/`xl`/`stress` → the big stress count; a number > 1 → that many
 *  cards; anything else truthy (`1`, `true`, `on`, `sample`) → the curated set. */
export function parseSeedEnv(raw: string | undefined | null): FakeSeedConfig {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "off" || v === "no") {
    return { active: false, size: "sample" };
  }
  if (v === "large" || v === "xl" || v === "stress" || v === "max") {
    return { active: true, size: LARGE_SEED_COUNT };
  }
  const n = Number(v);
  if (Number.isFinite(n) && n > 1) {
    return { active: true, size: Math.floor(n) };
  }
  // "1", "true", "on", "yes", "sample", or any other truthy token.
  return { active: true, size: "sample" };
}

/** Build a fresh fake-data document. `"sample"` returns just the curated
 *  edge-case cards; a number returns those cards plus enough generated cards to
 *  reach roughly that many contacts. The active card is the fully-loaded one so
 *  the screen opens on something worth looking at. */
export function buildFakeData(opts: { size?: FakeSeedSize } = {}): AppData {
  const size = opts.size ?? "sample";
  const curated = curatedContacts();

  const target = typeof size === "number" ? Math.max(0, size) : 0;
  const extra = Math.max(0, target - curated.length);
  const generated: Contact[] = [];
  for (let i = 0; i < extra; i++) generated.push(generatedContact(i));

  return {
    folders: CURATED_FOLDERS.map((f) => ({ ...f })),
    contacts: [...curated, ...generated],
    activeContactId: "seed-c-full",
  };
}
