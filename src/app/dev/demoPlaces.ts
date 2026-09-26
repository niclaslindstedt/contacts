// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The places half of the demo address book: the house and the people who keep
// it running, the hackerspace itself, and the short-lived cards at the menu
// root that tidy themselves away. Company cards carry `isCompany` and a
// fitting glyph. See `demoData.ts` for the roster overview.

import {
  BREAKER_SVG,
  BREAKER_SVG_SIZE,
  INDUCTION_PDF,
  INDUCTION_PDF_SIZE,
  QUOTE_PDF,
  QUOTE_PDF_SIZE,
} from "./demoFiles.ts";
import type { DemoContactSpec } from "./demoSpec.ts";

/** Home & services — Luis's card is the store's attachments frame. */
export const DEMO_HOME: DemoContactSpec[] = [
  {
    slug: "luis",
    first: "Luis",
    last: "Ortega",
    phones: [["+1 503 555 0155", "work", "primary"]],
    notes:
      "Electrician. Didn't flinch at the home-lab rack. Quote good for 30 days.",
    folder: "home",
    attachments: [
      {
        name: "breaker-map.svg",
        mime: "image/svg+xml",
        size: BREAKER_SVG_SIZE,
        description: "Which breaker is which, after the rewire",
        data: BREAKER_SVG,
      },
      {
        name: "quote-panel-upgrade.pdf",
        mime: "application/pdf",
        size: QUOTE_PDF_SIZE,
        description: "200A panel, two new circuits, permit included",
        data: QUOTE_PDF,
      },
    ],
  },
  {
    slug: "dale",
    first: "Dale",
    last: "Kowalski",
    company: "Kowalski Plumbing",
    relation: "business",
    phones: [["+1 503 555 0157", "work", "primary"]],
    notes: "Shows up when he says he will. Cash or check.",
    folder: "home",
  },
  {
    slug: "hiro",
    first: "Hiro",
    last: "Tanaka",
    company: "Tanaka Flowers",
    relation: "business",
    phones: [["+1 503 555 0161", "work", "primary"]],
    notes: "Maya's birthday: peonies. Order a week ahead.",
    folder: "home",
  },
  {
    slug: "kenji",
    first: "Kenji",
    last: "Mori",
    company: "Mori Sushi",
    phones: [["+1 503 555 0165", "work", "primary"]],
    notes: "Sit at the counter, say omakase, trust him.",
    folder: "home",
  },
  {
    slug: "hawthorne-vet",
    company: "Hawthorne Vet",
    isCompany: true,
    homepage: "https://hawthornevet.example",
    phones: [["+1 503 555 0168", "work", "primary"]],
    emails: [["desk@hawthornevet.example", "work"]],
    notes: "Kernel's vet. Shots every spring — ask for Dr. Liu.",
    folder: "home",
    glyph: "heart",
    color: "#f9a8d4",
  },
  {
    slug: "alder-bikes",
    company: "Alder St Bikes",
    isCompany: true,
    phones: [["+1 503 555 0177", "work", "primary"]],
    notes: "Ask for Kai. He'll true a wheel while you wait.",
    folder: "home",
    glyph: "store",
    color: "#fcd34d",
  },
  {
    slug: "northside-locks",
    company: "Northside Locksmith",
    isCompany: true,
    phones: [["+1 503 555 0179", "work", "primary"]],
    notes: "Open all night. Got us back in at 2am once. Worth every dollar.",
    folder: "home",
    glyph: "home",
    color: "#93c5fd",
  },
];

/** The hackerspace itself — its card carries the laser-cutter induction, the
 *  one file name the store's search frame matches. */
export const DEMO_HACKERSPACE_ORG: DemoContactSpec[] = [
  {
    slug: "foundry",
    company: "Foundry Hackerspace",
    isCompany: true,
    tags: ["Hackerspace"],
    homepage: "https://foundry.example",
    emails: [["hello@foundry.example", "work"]],
    addresses: [
      {
        label: "Space",
        street: "1130 SE Grand Ave",
        city: "Portland, OR 97214",
      },
    ],
    notes: "Open nights Tuesday and Thursday, 6 to 11. Dues on the 1st.",
    folder: "hackerspace",
    glyph: "users",
    color: "#86efac",
    attachments: [
      {
        name: "laser-cutter-induction.pdf",
        mime: "application/pdf",
        size: INDUCTION_PDF_SIZE,
        description: "What you may cut, and what you never cut",
        data: INDUCTION_PDF,
      },
    ],
  },
];

/** Loose cards at the menu root, each with an end date: the cabin host for a
 *  trip that starts in three days (the store's "tidy themselves away" frame),
 *  and a recruiter who deletes himself in a month. */
export const DEMO_SHORT_LIVED: DemoContactSpec[] = [
  {
    slug: "gus",
    first: "Gus",
    last: "Brennan",
    phones: [["+1 707 555 0148", "private", "primary"]],
    dates: [
      ["Check-in", { inDays: 3 }],
      ["Check-out", { inDays: 10 }],
    ],
    notes:
      "The Mendocino cabin. Lockbox 0417. Open the stove flue before lighting.",
    autoArchive: [{ inDays: 12 }, "archive"],
  },
  {
    slug: "kyle",
    first: "Kyle",
    last: "Pruitt",
    company: "Brightpath Talent",
    relation: "Recruiter",
    phones: [["+1 415 555 0103", "work", "primary"]],
    emails: [["kyle@brightpath.example", "work"]],
    notes: "Third recruiter this month. Said no, politely.",
    autoArchive: [{ inDays: 30 }, "delete"],
  },
];
