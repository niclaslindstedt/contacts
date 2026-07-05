// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  ArchiveIcon,
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  CloudIcon,
  CopyIcon,
  DatabaseIcon,
  FolderIcon,
  FolderOpenIcon,
  GiftIcon,
  ImageUpIcon,
  MapPinIcon,
  PaletteIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  UndoIcon,
} from "@niclaslindstedt/oss-framework/components";
import type {
  Achievement,
  AchievementGlyph,
  AchievementTier,
  Trigger,
} from "@niclaslindstedt/oss-framework/achievements";

import { hasAttachments } from "./attachments.ts";
import { hasPhoto as contactHasPhoto, photoCount } from "./contactPhotos.ts";
import { FavoriteIcon, IceIcon } from "./icons.tsx";
import type { AppData, Contact } from "./types.ts";
import { displayName } from "./types.ts";
import type { TFn } from "./i18n/index.ts";

// The app's achievement catalog — the "store stays in the app" half of the
// framework's achievements module. The framework owns the engine, the bus, and
// the trophy UI; this file owns *which* of the app's features are trophies and
// how each one unlocks. The watched state is the whole contacts document.
//
// Display copy is **not** here: an entry carries only its structural fields
// (id / tier / glyph / trigger). The English and Swedish name, condition, and
// optional learn-more body live in the i18n catalog under
// `achievements.catalog.<id>.*`, and `buildCatalog(t)` composes the two into
// the `Achievement` the framework renders — so every trophy is translated the
// same way the rest of the app is. Adding an entry means adding its `Spec` here
// **and** its three strings to both `en.ts` and `sv.ts`.

export type AchState = AppData;

// --- predicate helpers -------------------------------------------------------

const named = (c: Contact) => displayName(c).length > 0;
const hasContact = (d: AchState) => d.contacts.some(named);
const manyContacts = (d: AchState) => d.contacts.filter(named).length >= 5;
const hasFolder = (d: AchState) => d.folders.length > 0;
const hasPhoto = (d: AchState) => d.contacts.some(contactHasPhoto);
const hasGallery = (d: AchState) => d.contacts.some((c) => photoCount(c) >= 2);
const hasStyled = (d: AchState) =>
  d.contacts.some((c) => Boolean(c.glyph) || Boolean(c.color));
const wellConnected = (d: AchState) =>
  d.contacts.some(
    (c) =>
      c.phones.some((p) => p.value.trim()) &&
      c.emails.some((e) => e.value.trim()),
  );
const hasBirthday = (d: AchState) =>
  d.contacts.some((c) => Boolean(c.birthday?.trim()));
const hasImportantDate = (d: AchState) =>
  d.contacts.some((c) => c.importantDates.some((v) => Boolean(v.date?.trim())));
const hasAddress = (d: AchState) =>
  d.contacts.some((c) =>
    c.addresses.some((a) =>
      Boolean(a.street?.trim() || a.zip?.trim() || a.city?.trim()),
    ),
  );
const hasFavorite = (d: AchState) =>
  d.contacts.some((c) => Boolean(c.favorite));
const hasEmergency = (d: AchState) => d.contacts.some((c) => Boolean(c.ice));
const hasCompany = (d: AchState) =>
  d.contacts.some((c) => Boolean(c.isCompany));
const hasArchived = (d: AchState) =>
  d.contacts.some((c) => Boolean(c.archived));
const hasAutoArchive = (d: AchState) =>
  d.contacts.some((c) => Boolean(c.autoArchiveDate?.trim()));
const hasAttachment = (d: AchState) => d.contacts.some(hasAttachments);
// A subfolder is a folder whose parent still exists (a dangling parent id reads
// as a root — see `Folder.parentId`), so nesting only counts once it's real.
const hasSubfolder = (d: AchState) =>
  d.folders.some(
    (f) => f.parentId && d.folders.some((p) => p.id === f.parentId),
  );

// A derived entry fires when its predicate flips false → true across an edit.
const derived = (
  pred: (d: AchState) => boolean,
  slice: (d: AchState) => unknown,
): Trigger<AchState> => ({
  kind: "derived",
  slices: (d: AchState) => [slice(d)],
  predicate: (p: AchState, n: AchState) => !pred(p) && pred(n),
});

const manual: Trigger<AchState> = { kind: "manual" };
const contacts = (d: AchState) => d.contacts;
const folders = (d: AchState) => d.folders;

// --- the catalog spec --------------------------------------------------------

// One trophy, structurally. `hasLearnMore` gates whether `buildCatalog` looks
// up an expanded body; the display strings live in i18n keyed by `id`.
type Spec = {
  id: string;
  tier: AchievementTier;
  glyph: AchievementGlyph;
  hasLearnMore?: boolean;
  trigger: Trigger<AchState>;
};

export const SPECS: readonly Spec[] = [
  // ── Beginner ──────────────────────────────────────────────────────────
  {
    id: "firstContact",
    tier: "beginner",
    glyph: PlusIcon,
    hasLearnMore: true,
    trigger: derived(hasContact, contacts),
  },
  {
    id: "wellConnected",
    tier: "beginner",
    glyph: CheckIcon,
    trigger: derived(wellConnected, contacts),
  },
  // ── Intermediate ──────────────────────────────────────────────────────
  {
    id: "collector",
    tier: "intermediate",
    glyph: SparklesIcon,
    trigger: derived(manyContacts, contacts),
  },
  {
    id: "filingSystem",
    tier: "intermediate",
    glyph: FolderIcon,
    trigger: derived(hasFolder, folders),
  },
  {
    id: "subfolder",
    tier: "intermediate",
    glyph: FolderOpenIcon,
    hasLearnMore: true,
    trigger: derived(hasSubfolder, folders),
  },
  {
    id: "seeker",
    tier: "intermediate",
    glyph: SearchIcon,
    // Searching is a gesture, not a document change, so it fires through the
    // manual bus from the search overlay.
    trigger: manual,
  },
  {
    id: "birthday",
    tier: "intermediate",
    glyph: CalendarIcon,
    trigger: derived(hasBirthday, contacts),
  },
  {
    id: "importantDate",
    tier: "intermediate",
    glyph: GiftIcon,
    trigger: derived(hasImportantDate, contacts),
  },
  {
    id: "address",
    tier: "intermediate",
    glyph: MapPinIcon,
    trigger: derived(hasAddress, contacts),
  },
  {
    id: "favorite",
    tier: "intermediate",
    glyph: FavoriteIcon,
    hasLearnMore: true,
    trigger: derived(hasFavorite, contacts),
  },
  {
    id: "emergency",
    tier: "intermediate",
    glyph: IceIcon,
    trigger: derived(hasEmergency, contacts),
  },
  {
    id: "company",
    tier: "intermediate",
    glyph: BuildingIcon,
    trigger: derived(hasCompany, contacts),
  },
  {
    id: "archivist",
    tier: "intermediate",
    glyph: ArchiveIcon,
    trigger: derived(hasArchived, contacts),
  },
  {
    id: "namespaces",
    tier: "intermediate",
    glyph: CopyIcon,
    hasLearnMore: true,
    // Namespaces live in the registry, not this document, so the trophy fires
    // through the manual bus when a second address book is created.
    trigger: manual,
  },
  // ── Pro ───────────────────────────────────────────────────────────────
  {
    id: "photogenic",
    tier: "pro",
    glyph: SparklesIcon,
    hasLearnMore: true,
    trigger: derived(hasPhoto, contacts),
  },
  {
    id: "gallery",
    tier: "pro",
    glyph: ImageUpIcon,
    trigger: derived(hasGallery, contacts),
  },
  {
    id: "madeItYours",
    tier: "pro",
    glyph: PaletteIcon,
    trigger: derived(hasStyled, contacts),
  },
  {
    id: "attachment",
    tier: "pro",
    glyph: PaperclipIcon,
    hasLearnMore: true,
    trigger: derived(hasAttachment, contacts),
  },
  {
    id: "synced",
    tier: "pro",
    glyph: CloudIcon,
    hasLearnMore: true,
    // Connecting a backend is a state change outside the document, so it fires
    // through the manual bus from the app's sync effect.
    trigger: manual,
  },
  {
    id: "backup",
    tier: "pro",
    glyph: DatabaseIcon,
    hasLearnMore: true,
    // Taking a backup doesn't change the document; fired from the backup flows.
    trigger: manual,
  },
  // ── Expert ────────────────────────────────────────────────────────────
  {
    id: "timeTraveler",
    tier: "expert",
    glyph: UndoIcon,
    // Undo lives outside the document state, so it fires through the manual bus.
    trigger: manual,
  },
  {
    id: "autoArchive",
    tier: "expert",
    glyph: RefreshIcon,
    hasLearnMore: true,
    trigger: derived(hasAutoArchive, contacts),
  },
  {
    id: "exporter",
    tier: "expert",
    glyph: SparklesIcon,
    // Exporting doesn't change the document, so it fires through the manual
    // bus from the export buttons.
    trigger: manual,
  },
  {
    id: "importer",
    tier: "expert",
    glyph: PlusIcon,
    hasLearnMore: true,
    // Importing files into the document is a document change, but the drop can
    // land anywhere; it fires through the manual bus from the import flow.
    trigger: manual,
  },
  {
    id: "encryption",
    tier: "expert",
    glyph: ShieldIcon,
    hasLearnMore: true,
    // Turning on encryption is a sync-state change, fired from the app's effect.
    trigger: manual,
  },
];

// Compose the structural specs with their translated strings into the catalog
// the framework's modal and watcher consume. Called with the app's `t` so the
// names, conditions, and learn-more bodies follow the active language; memoise
// it per `t` at the call site (`App.tsx`).
export function buildCatalog(t: TFn): readonly Achievement<AchState>[] {
  const str = (id: string, leaf: "name" | "condition" | "learnMore") =>
    t(`achievements.catalog.${id}.${leaf}` as Parameters<TFn>[0]);
  return SPECS.map(({ id, tier, glyph, hasLearnMore, trigger }) => ({
    id,
    tier,
    glyph,
    name: str(id, "name"),
    condition: str(id, "condition"),
    ...(hasLearnMore ? { learnMore: str(id, "learnMore") } : {}),
    trigger,
  }));
}
