// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  createMigrator,
  type Versioned,
} from "@niclaslindstedt/oss-framework/storage";

import { parseAddress } from "./address.ts";
import { toStoredPhone } from "./format.ts";
import { logStore } from "./log.ts";
import type { AppData, Contact, Folder } from "./types.ts";

// The persisted-document migration chain, built on the framework's
// `createMigrator`. The framework owns the engine (run a parsed document
// forward, throw on a newer-than-build or gappy chain); the *steps* below are
// this app's own data model.
//
// The version lives only on the bytes at rest: `AppData` (the in-memory model)
// stays version-free; `useContactStore` stamps `LATEST_VERSION` when it writes
// and runs `migrator.migrate` when it reads — and the same bytes travel to the
// cloud backends, so a document written by an older build upgrades wherever it
// comes back from.

/** The current persisted-document version. Bump it and add a step below when
 *  the on-disk shape changes — every shipped step stays forever. */
export const LATEST_VERSION = 6;

const migrations = {
  // v0 (pre-versioning / blank) → v1: the bootstrap step. Guarantee the two
  // arrays and the active-contact pointer exist, and give every contact the
  // list fields the screens read unconditionally.
  0: (doc: Versioned): Versioned => {
    const contacts = (Array.isArray(doc.contacts) ? doc.contacts : []).map(
      (raw) => {
        const c = raw as Record<string, unknown>;
        return {
          ...c,
          firstName: typeof c.firstName === "string" ? c.firstName : "",
          lastName: typeof c.lastName === "string" ? c.lastName : "",
          phones: Array.isArray(c.phones) ? c.phones : [],
          emails: Array.isArray(c.emails) ? c.emails : [],
          folderId: typeof c.folderId === "string" ? c.folderId : null,
        };
      },
    );
    return {
      ...doc,
      version: 1,
      folders: Array.isArray(doc.folders) ? doc.folders : [],
      contacts,
      activeContactId:
        typeof doc.activeContactId === "string"
          ? doc.activeContactId
          : ((contacts[0] as Contact | undefined)?.id ?? ""),
    };
  },
  // v1 → v2: the free-form `address` string becomes three structured fields
  // (`street` / `zip` / `city`). Best-effort split the old blob so an existing
  // address survives the upgrade; drop the retired `address` key.
  1: (doc: Versioned): Versioned => {
    const contacts = (Array.isArray(doc.contacts) ? doc.contacts : []).map(
      (raw) => {
        const { address, ...rest } = raw as Record<string, unknown>;
        if (typeof address === "string" && address.trim()) {
          return { ...rest, ...parseAddress(address) };
        }
        return rest;
      },
    );
    return { ...doc, version: 2, contacts };
  },
  // v2 → v3: the single flat address (`street` / `zip` / `city`) becomes an
  // `addresses` array so a card can hold several titled addresses, and a new
  // `importantDates` array joins the birthday. Fold any existing flat address
  // into the first entry (untitled — the UI shows the "Home" placeholder) and
  // drop the retired keys; guarantee both arrays exist on every contact.
  2: (doc: Versioned): Versioned => {
    const contacts = (Array.isArray(doc.contacts) ? doc.contacts : []).map(
      (raw) => {
        const { street, zip, city, ...rest } = raw as Record<string, unknown>;
        const addresses = Array.isArray(rest.addresses) ? rest.addresses : [];
        const hasFlat = [street, zip, city].some(
          (v) => typeof v === "string" && v.trim(),
        );
        if (hasFlat) {
          addresses.unshift({
            id: `${typeof rest.id === "string" ? rest.id : "addr"}-address`,
            ...(typeof street === "string" && street.trim() ? { street } : {}),
            ...(typeof zip === "string" && zip.trim() ? { zip } : {}),
            ...(typeof city === "string" && city.trim() ? { city } : {}),
          });
        }
        return {
          ...rest,
          addresses,
          importantDates: Array.isArray(rest.importantDates)
            ? rest.importantDates
            : [],
        };
      },
    );
    return { ...doc, version: 3, contacts };
  },
  // v3 → v4: the single inline photo (`photo` / `photoSource` / `photoTransform`
  // and the cloud `photoPath` / `photoSourcePath`) becomes a `photos` array so a
  // card can hold several pictures and swap which is its face (see
  // `contactPhotos.ts`). Fold any existing photo into the first gallery entry —
  // its id derived from the contact id so the migration is deterministic across
  // parses (localStorage and the cloud copy agree) — and drop the retired flat
  // keys. A photo-less card gets no `photos` key at all, so the upgrade doesn't
  // bloat the document; the accessors treat an absent array as an empty gallery.
  3: (doc: Versioned): Versioned => {
    const contacts = (Array.isArray(doc.contacts) ? doc.contacts : []).map(
      (raw) => {
        const {
          photo,
          photoSource,
          photoTransform,
          photoPath,
          photoSourcePath,
          ...rest
        } = raw as Record<string, unknown>;
        const photos = Array.isArray(rest.photos) ? rest.photos : [];
        const hasLegacy = [photo, photoSource, photoPath, photoSourcePath].some(
          (v) => typeof v === "string" && v.trim(),
        );
        if (hasLegacy && photos.length === 0) {
          photos.push({
            id: `${typeof rest.id === "string" ? rest.id : "photo"}-photo`,
            ...(typeof photo === "string" && photo.trim() ? { photo } : {}),
            ...(typeof photoSource === "string" && photoSource.trim()
              ? { photoSource }
              : {}),
            ...(photoTransform && typeof photoTransform === "object"
              ? { photoTransform }
              : {}),
            ...(typeof photoPath === "string" && photoPath.trim()
              ? { photoPath }
              : {}),
            ...(typeof photoSourcePath === "string" && photoSourcePath.trim()
              ? { photoSourcePath }
              : {}),
          });
        }
        return photos.length > 0 ? { ...rest, photos } : rest;
      },
    );
    return { ...doc, version: 4, contacts };
  },
  // v4 → v5: phone numbers become *structured*. A phone used to hold whatever
  // the user typed verbatim (`+46 (0)70-123 45 67`); now `value` is the bare
  // national digits and the E.164 calling code moves to its own `countryCode`
  // field (the edit form's country dropdown). Fold every existing number down
  // to that shape — strip separators, peel an explicit `+…`/`00…` code — so old
  // documents display and edit the same as freshly-typed ones. A number with no
  // explicit code keeps `countryCode` absent (it follows the home country).
  4: (doc: Versioned): Versioned => {
    const contacts = (Array.isArray(doc.contacts) ? doc.contacts : []).map(
      (raw) => {
        const c = raw as Record<string, unknown>;
        const phones = (Array.isArray(c.phones) ? c.phones : []).map((rawP) => {
          const p = rawP as Record<string, unknown>;
          const value = typeof p.value === "string" ? p.value : "";
          // Keep the row's id/label; replace the verbatim value with the
          // national digits and the calling code parsed out of it.
          return { ...p, ...toStoredPhone(value) };
        });
        return { ...c, phones };
      },
    );
    return { ...doc, version: 5, contacts };
  },
  // v5 → v6: a card gains `createdAt` / `updatedAt` timestamps (the read view's
  // foot-of-card date stamp). Neither existed before, so stamp every existing
  // card's `createdAt` with the migration time — a best-effort "we first saw it
  // now" — and leave `updatedAt` absent, so an untouched card shows no
  // "Modified" line until it's next edited. A card that somehow already carries
  // a `createdAt` keeps it.
  5: (doc: Versioned): Versioned => {
    const now = new Date().toISOString();
    const contacts = (Array.isArray(doc.contacts) ? doc.contacts : []).map(
      (raw) => {
        const c = raw as Record<string, unknown>;
        return typeof c.createdAt === "string" ? c : { ...c, createdAt: now };
      },
    );
    return { ...doc, version: 6, contacts };
  },
} as const;

export const migrator = createMigrator({
  latestVersion: LATEST_VERSION,
  migrations,
  // Route the one "migrated vX → vY" line into the same in-app buffer the Logs
  // tab renders — so an upgrade is visible, not silent.
  logger: logStore.createLogger("migrate"),
});

/** Narrow a migrated document back to the app's version-free model. The chain
 *  guarantees the fields exist; this just re-asserts the static shape. */
export function toAppData(doc: Versioned): AppData {
  return {
    folders: (Array.isArray(doc.folders) ? doc.folders : []) as Folder[],
    contacts: (Array.isArray(doc.contacts) ? doc.contacts : []) as Contact[],
    activeContactId:
      typeof doc.activeContactId === "string" ? doc.activeContactId : "",
  };
}

/** Serialize a document for the bytes at rest (localStorage and the cloud
 *  backends): stamp the latest version onto the version-free model. */
export function serializeDoc(data: AppData): string {
  return JSON.stringify({ version: LATEST_VERSION, ...data });
}

/** Parse bytes from any backend into the app model, upgrading old shapes. */
export function parseDoc(text: string): AppData {
  return toAppData(migrator.migrate(JSON.parse(text)).data);
}
