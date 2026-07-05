// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The developer "Demo data" document — the presentation-grade counterpart to
// `fakeData.ts`. Where fake data leans into the awkward (blank cards, overflow
// strings, RTL stress), demo data is the *perfect* address book: roughly a
// hundred realistic, hand-written contacts that read like the catalogue of
// someone who has spent years keeping their contacts in order — family with
// birthdays and name days, friends at home and abroad, colleagues and clients,
// the kids' school circle, and every service a household accumulates.
//
// The story: an unnamed Stockholm professional's address book. Their spouse
// (Sara) is ICE-flagged and favorite #1; contacts file into a nested folder
// tree (Family ▸ In-laws, Work ▸ Clients); the previous employer's folder is
// archived wholesale; a holiday cabin rental auto-archives itself when the
// trip ends; two cards carry real (tiny) PDF attachments. Every field the
// model offers is exercised somewhere — but, like a real address book, not on
// every card. All names, companies, numbers (drama ranges), and addresses are
// fictional; mail domains use the reserved `example` names. No photos: there
// is no freely redistributable CC0 portrait source to embed, so cards wear
// the app's glyph/colour avatars instead.
//
// A pure, deterministic builder like `buildFakeData`: no randomness, no clock,
// a fresh `AppData` each call. Loaded only through the in-memory demo backend
// (see `seedBackend.ts`) — never persisted, gone on reload.

import { toStoredPhone } from "../format.ts";
import type { AppData, Contact, Folder } from "../types.ts";
import { type DemoContactSpec, type DemoFolderKey } from "./demoSpec.ts";
import {
  DEMO_ACQUAINTANCES,
  DEMO_ARCHIVED_PEOPLE,
  DEMO_FAMILY,
  DEMO_FRIENDS,
  DEMO_INLAWS,
} from "./demoPeople.ts";
import { DEMO_SCHOOL, DEMO_SERVICES } from "./demoPlaces.ts";
import { DEMO_CLIENTS, DEMO_OLD_JOB, DEMO_WORK } from "./demoWork.ts";

// The folder tree: nested circles (Family ▸ In-laws, Work ▸ Clients) plus the
// realistically archived previous-employer folder. Stable ids, like the seed's.
const FOLDER_ID: Record<DemoFolderKey, string> = {
  family: "demo-fld-family",
  inlaws: "demo-fld-inlaws",
  friends: "demo-fld-friends",
  work: "demo-fld-work",
  clients: "demo-fld-clients",
  school: "demo-fld-school",
  services: "demo-fld-services",
  oldjob: "demo-fld-oldjob",
};

const DEMO_FOLDERS: Folder[] = [
  { id: FOLDER_ID.family, name: "Family" },
  { id: FOLDER_ID.inlaws, name: "In-laws", parentId: FOLDER_ID.family },
  { id: FOLDER_ID.friends, name: "Friends" },
  { id: FOLDER_ID.work, name: "Work" },
  { id: FOLDER_ID.clients, name: "Clients", parentId: FOLDER_ID.work },
  { id: FOLDER_ID.school, name: "School & activities" },
  { id: FOLDER_ID.services, name: "Home & services" },
  {
    id: FOLDER_ID.oldjob,
    name: "Nordvik Consulting (old job)",
    archived: true,
  },
];

/** The whole roster, in the order the circles are authored. */
export const DEMO_CONTACT_SPECS: readonly DemoContactSpec[] = [
  ...DEMO_FAMILY,
  ...DEMO_INLAWS,
  ...DEMO_FRIENDS,
  ...DEMO_WORK,
  ...DEMO_CLIENTS,
  ...DEMO_SCHOOL,
  ...DEMO_SERVICES,
  ...DEMO_ACQUAINTANCES,
  ...DEMO_ARCHIVED_PEOPLE,
  ...DEMO_OLD_JOB,
];

/** Expand one authored spec into a real `Contact`. Ids derive from the spec's
 *  slug (`demo-c-sara`, `demo-sara-ph1`, …) so the built document — and the
 *  active-card pointer into it — is identical on every build. */
function expandContact(spec: DemoContactSpec): Contact {
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
    importantDates: (spec.dates ?? []).map(([label, date], i) => ({
      id: `demo-${spec.slug}-dt${i + 1}`,
      label,
      date,
    })),
    folderId: spec.folder ? FOLDER_ID[spec.folder] : null,
  };

  if (spec.company) contact.company = spec.company;
  if (spec.isCompany) contact.isCompany = true;
  if (spec.homepage) contact.homepage = spec.homepage;
  if (spec.birthday) contact.birthday = spec.birthday;
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
    contact.autoArchiveDate = spec.autoArchive[0];
    contact.autoArchiveAction = spec.autoArchive[1];
  }
  if (spec.attachments) {
    contact.attachments = spec.attachments.map((a, i) => ({
      id: `demo-${spec.slug}-att${i + 1}`,
      ...a,
    }));
  }

  return contact;
}

/** Build a fresh demo document. Opens on the partner's card — the fullest one
 *  in the book — so the first screen of a demo already has everything on it. */
export function buildDemoData(): AppData {
  return {
    folders: DEMO_FOLDERS.map((f) => ({ ...f })),
    contacts: DEMO_CONTACT_SPECS.map(expandContact),
    activeContactId: "demo-c-sara",
  };
}
