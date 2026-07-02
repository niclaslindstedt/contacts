// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  CheckIcon,
  FolderIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  UndoIcon,
} from "@niclaslindstedt/oss-framework/components";
import type { Achievement } from "@niclaslindstedt/oss-framework/achievements";

import type { AppData, Contact } from "./types.ts";
import { displayName } from "./types.ts";

// The app's achievement catalog — the "store stays in the app" half of the
// framework's achievements module. The framework owns the engine, the bus, and
// the trophy UI; this file owns *which* of the app's features are trophies and
// how each one unlocks. The watched state is the whole contacts document.
//
// Display copy lives inline on each entry (English); the modal chrome is
// translated through the app's i18n.

export type AchState = AppData;

// --- predicate helpers -------------------------------------------------------

const named = (c: Contact) => displayName(c).length > 0;
const hasContact = (d: AchState) => d.contacts.some(named);
const manyContacts = (d: AchState) => d.contacts.filter(named).length >= 5;
const hasFolder = (d: AchState) => d.folders.length > 0;
const hasPhoto = (d: AchState) => d.contacts.some((c) => Boolean(c.photo));
const hasStyled = (d: AchState) =>
  d.contacts.some((c) => Boolean(c.glyph) || Boolean(c.color));
const wellConnected = (d: AchState) =>
  d.contacts.some(
    (c) =>
      c.phones.some((p) => p.value.trim()) &&
      c.emails.some((e) => e.value.trim()),
  );

// A derived entry fires when its predicate flips false → true across an edit.
const derived = (
  pred: (d: AchState) => boolean,
  slice: (d: AchState) => unknown,
) =>
  ({
    kind: "derived",
    slices: (d: AchState) => [slice(d)],
    predicate: (p: AchState, n: AchState) => !pred(p) && pred(n),
  }) as const;

export const CATALOG: readonly Achievement<AchState>[] = [
  // ── Beginner ──────────────────────────────────────────────────────────
  {
    id: "firstContact",
    tier: "beginner",
    glyph: PlusIcon,
    name: "First Contact",
    condition: "Name your first contact.",
    learnMore:
      "Tap New, type a name, press Enter. That single card is the loop the whole app is built around.",
    trigger: derived(hasContact, (d) => d.contacts),
  },
  {
    id: "wellConnected",
    tier: "beginner",
    glyph: CheckIcon,
    name: "Well Connected",
    condition: "Give a contact both a phone number and an email.",
    trigger: derived(wellConnected, (d) => d.contacts),
  },
  // ── Intermediate ──────────────────────────────────────────────────────
  {
    id: "collector",
    tier: "intermediate",
    glyph: SparklesIcon,
    name: "Collector",
    condition: "Keep five or more contacts.",
    trigger: derived(manyContacts, (d) => d.contacts),
  },
  {
    id: "filingSystem",
    tier: "intermediate",
    glyph: FolderIcon,
    name: "Filing System",
    condition: "Create a folder.",
    trigger: derived(hasFolder, (d) => d.folders),
  },
  {
    id: "seeker",
    tier: "intermediate",
    glyph: SearchIcon,
    name: "Seeker",
    condition: "Search your contacts.",
    // Searching is a gesture, not a document change, so it fires through the
    // manual bus from the search overlay.
    trigger: { kind: "manual" },
  },
  // ── Pro ───────────────────────────────────────────────────────────────
  {
    id: "photogenic",
    tier: "pro",
    glyph: SparklesIcon,
    name: "Photogenic",
    condition: "Give a contact a photo.",
    learnMore:
      "Open a card's avatar in the header and upload a picture — it shows in the side menu and travels with vCard exports.",
    trigger: derived(hasPhoto, (d) => d.contacts),
  },
  {
    id: "madeItYours",
    tier: "pro",
    glyph: PaletteIcon,
    name: "Made It Yours",
    condition: "Give a contact an icon or colour.",
    trigger: derived(hasStyled, (d) => d.contacts),
  },
  // ── Expert ────────────────────────────────────────────────────────────
  {
    id: "timeTraveler",
    tier: "expert",
    glyph: UndoIcon,
    name: "Time Traveler",
    condition: "Undo a change.",
    // Undo lives outside the document state, so it fires through the manual bus.
    trigger: { kind: "manual" },
  },
  {
    id: "exporter",
    tier: "expert",
    glyph: SparklesIcon,
    name: "Emigrant",
    condition: "Export your contacts.",
    // Exporting doesn't change the document, so it fires through the manual
    // bus from the export buttons.
    trigger: { kind: "manual" },
  },
];
