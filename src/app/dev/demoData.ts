// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The developer "Demo data" document — the presentation-grade counterpart to
// `fakeData.ts`, and what the App Store screenshots are taken of (`VITE_SEED=
// demo`, `make demo`). Where fake data leans into the awkward (blank cards,
// overflow strings, RTL stress), demo data is one person's address book,
// kept well: an unnamed developer in Portland, their partner Maya and the
// family, friends near and abroad, the hackerspace, the team at work and two
// freelance clients, the house and the people who fix it — and two cards with
// an end date, the cabin host and a recruiter, that tidy themselves away.
//
// About fifty cards, each somebody a reader can picture, and nearly every one
// carries a note — the thing the stock address book has no field for. The
// store frames lean on specific cards: Priya's card fits a phone, four notes
// and one file name answer the search frame's regex, Luis carries the
// attachments, Gus archives himself. `tests/demoData_test.ts` holds the data to each.
//
// A pure, deterministic builder for a given moment: no randomness, and every
// date that could age — the added/edited stamps, a birthday that is always
// nine days off, the cabin trip, the auto-archive dates — is computed from
// `now`, so the demo reads the same whenever it is opened. All names,
// companies, numbers (fiction ranges) and addresses are invented; mail uses
// the reserved `example` names. Loaded only through the in-memory demo backend
// (see `seedBackend.ts`) — never persisted, gone on reload.

import { toStoredPhone } from "@niclaslindstedt/oss-framework/format";
import type { AppData, Contact, Folder } from "../types.ts";
import {
  type DemoContactSpec,
  type DemoDay,
  type DemoFolderKey,
} from "./demoSpec.ts";
import { DEMO_FAMILY, DEMO_FRIENDS, DEMO_HACKERSPACE } from "./demoPeople.ts";
import {
  DEMO_HACKERSPACE_ORG,
  DEMO_HOME,
  DEMO_SHORT_LIVED,
} from "./demoPlaces.ts";
import { DEMO_CLIENTS, DEMO_OLD_JOB, DEMO_WORK } from "./demoWork.ts";

// The folder tree: the circles of one life, Work ▸ Clients nested, and the
// previous job's folder archived whole. Stable ids, like the seed's.
const FOLDER_ID: Record<DemoFolderKey, string> = {
  family: "demo-fld-family",
  friends: "demo-fld-friends",
  hackerspace: "demo-fld-hackerspace",
  work: "demo-fld-work",
  clients: "demo-fld-clients",
  home: "demo-fld-home",
  oldjob: "demo-fld-oldjob",
};

export const DEMO_FOLDERS: readonly Folder[] = [
  { id: FOLDER_ID.family, name: "Family" },
  { id: FOLDER_ID.friends, name: "Friends" },
  { id: FOLDER_ID.hackerspace, name: "Hackerspace" },
  { id: FOLDER_ID.work, name: "Work" },
  { id: FOLDER_ID.clients, name: "Clients", parentId: FOLDER_ID.work },
  { id: FOLDER_ID.home, name: "Home & services" },
  { id: FOLDER_ID.oldjob, name: "Tidewater (old job)", archived: true },
];

/** The whole roster, in the order the circles are authored. */
export const DEMO_CONTACT_SPECS: readonly DemoContactSpec[] = [
  ...DEMO_FAMILY,
  ...DEMO_FRIENDS,
  ...DEMO_HACKERSPACE,
  ...DEMO_HACKERSPACE_ORG,
  ...DEMO_WORK,
  ...DEMO_CLIENTS,
  ...DEMO_HOME,
  ...DEMO_SHORT_LIVED,
  ...DEMO_OLD_JOB,
];

// The portrait map is ~130 KB of base64 JPEG, so it ships as its own lazy
// chunk rather than in the main bundle every user parses on first load.
// `setDevDataMode` awaits `loadDemoPhotos` before flipping into demo mode, so
// by the time the demo backend seeds a document the cache is always filled —
// the sync `buildDemoData` never has to wait on it.
let demoPhotos: Record<string, string> = {};

/** Pull the portrait chunk into the builder's cache. Idempotent; resolves
 *  once the faces are ready to be baked into built documents. */
export async function loadDemoPhotos(): Promise<void> {
  const m = await import("./demoPhotos.ts");
  demoPhotos = m.DEMO_PHOTOS;
}

const DAY_MS = 86_400_000;

/** A local calendar day as `YYYY-MM-DD`. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Resolve an authored day against the moment the demo opens. */
export function resolveDemoDay(day: DemoDay, now: number): string {
  if (typeof day === "string") return day;
  const d = new Date(now);
  d.setDate(d.getDate() + day.inDays);
  if (day.year === undefined) return isoDay(d);
  return `${day.year}${isoDay(d).slice(4)}`;
}

/** A small, stable per-slug offset so two cards at the same roster position
 *  still differ. Pure function of the slug. */
function slugJitter(slug: string): number {
  let n = 0;
  for (const ch of slug) n = (n * 31 + ch.charCodeAt(0)) % 100000;
  return n;
}

/** "Added / last edited" stamps for a demo card, on a timeline that ends a
 *  few weeks before `now`: the close circle was added first, six years back;
 *  the archived old job predates the book; favorites and the emergency cards
 *  — the ones actually used — were edited in the last months, a slice of the
 *  rest some time after they were added, and the remainder never (so the
 *  stamp shows "Added" alone). */
function demoTimestamps(
  spec: DemoContactSpec,
  index: number,
  total: number,
  now: number,
): { createdAt: string; updatedAt?: string } {
  const j = slugJitter(spec.slug);
  const start = now - 6 * 365 * DAY_MS;
  const end = now - 21 * DAY_MS;
  if (spec.archived) {
    const created = start - (700 + (j % 400)) * DAY_MS;
    const updated = start - (60 + (j % 200)) * DAY_MS;
    return {
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(updated).toISOString(),
    };
  }
  const frac = total > 1 ? index / (total - 1) : 0;
  const created =
    start + Math.round(frac * (end - start - 40 * DAY_MS)) + (j % 21) * DAY_MS;
  let updated: number | undefined;
  if (spec.favorite !== undefined || spec.ice) {
    const cand = end - (j % 120) * DAY_MS;
    if (cand > created + 30 * DAY_MS) updated = cand;
  } else if (j % 5 < 2) {
    const cand = created + (30 + (j % 400)) * DAY_MS;
    if (cand <= end) updated = cand;
  }
  return {
    createdAt: new Date(created).toISOString(),
    ...(updated ? { updatedAt: new Date(updated).toISOString() } : {}),
  };
}

/** Expand one authored spec into a real `Contact`. Ids derive from the spec's
 *  slug (`demo-c-priya`, `demo-priya-ph1`, …) so the built document — and the
 *  active-card pointer into it — is identical on every build. */
function expandContact(
  spec: DemoContactSpec,
  index: number,
  total: number,
  now: number,
): Contact {
  const contact: Contact = {
    id: `demo-c-${spec.slug}`,
    firstName: spec.first ?? "",
    lastName: spec.last ?? "",
    // The numbers are authored the way a person types them (international
    // `+…` format); fold each down to the stored shape (national digits +
    // calling code), exactly like the edit form does on commit.
    phones: (spec.phones ?? []).map(([value, kind, primary], i) => ({
      id: `demo-${spec.slug}-ph${i + 1}`,
      ...toStoredPhone(value),
      label: kind ?? "private",
      ...(primary ? { primary: true } : {}),
    })),
    emails: (spec.emails ?? []).map(([value, kind], i) => ({
      id: `demo-${spec.slug}-em${i + 1}`,
      value,
      label: kind ?? "private",
    })),
    addresses: (spec.addresses ?? []).map((a, i) => ({
      id: `demo-${spec.slug}-ad${i + 1}`,
      ...a,
    })),
    importantDates: (spec.dates ?? []).map(([label, day], i) => ({
      id: `demo-${spec.slug}-dt${i + 1}`,
      label,
      date: resolveDemoDay(day, now),
    })),
    folderId: spec.folder ? FOLDER_ID[spec.folder] : null,
  };

  if (spec.company) contact.company = spec.company;
  if (spec.isCompany) contact.isCompany = true;
  if (spec.homepage) contact.homepage = spec.homepage;
  if (spec.relation) contact.relation = spec.relation;
  if (spec.tags) contact.tags = [...spec.tags];
  if (spec.birthday) contact.birthday = resolveDemoDay(spec.birthday, now);
  if (spec.notes) contact.notes = spec.notes;
  if (spec.glyph) contact.glyph = spec.glyph;
  if (spec.color) contact.color = spec.color;
  if (spec.ice) contact.ice = true;
  if (spec.archived) contact.archived = true;
  // `favorite` in the spec is the card's position on the Favorites page;
  // presence means starred.
  if (spec.favorite !== undefined) {
    contact.favorite = true;
    contact.favoriteOrder = spec.favorite;
  }
  if (spec.autoArchive) {
    contact.autoArchiveDate = resolveDemoDay(spec.autoArchive[0], now);
    contact.autoArchiveAction = spec.autoArchive[1];
  }
  if (spec.attachments) {
    contact.attachments = spec.attachments.map((a, i) => ({
      id: `demo-${spec.slug}-att${i + 1}`,
      ...a,
    }));
  }
  // Cards cast with a portrait (see `demoPhotos.ts`) get a one-photo gallery;
  // the rest keep their glyph/colour avatar.
  const photo = demoPhotos[spec.slug];
  if (photo) {
    contact.photos = [{ id: `demo-${spec.slug}-photo`, photo }];
  }

  const { createdAt, updatedAt } = demoTimestamps(spec, index, total, now);
  contact.createdAt = createdAt;
  if (updatedAt) contact.updatedAt = updatedAt;

  return contact;
}

/** Build a fresh demo document for the moment `now`. Opens on Priya's card —
 *  the one the first store frame shows. */
export function buildDemoData(now: number = Date.now()): AppData {
  const total = DEMO_CONTACT_SPECS.length;
  return {
    folders: DEMO_FOLDERS.map((f) => ({ ...f })),
    contacts: DEMO_CONTACT_SPECS.map((spec, i) =>
      expandContact(spec, i, total, now),
    ),
    activeContactId: "demo-c-priya",
  };
}
