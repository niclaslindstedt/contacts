// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app-owned half of the contact-photo pipeline. The intake, geometry, and
// bake now live in the framework's viewer module (`readImageSource`,
// `ImageCropper`, `bakeCrop`); what stays here is the domain glue: the mapping
// between the stored `PhotoTransform` and the framework's `ViewTransform`
// (same numbers, app field names), and the deterministic cloud file paths. On
// a cloud backend both the display crop and the kept source are externalised
// to real binary JPEG files at these paths (`photoPathFor` /
// `photoSourcePathFor`) — the framework's `dataUrl`⇄`bytes` codec (its `files`
// module) is what the externaliser decodes across so what lands on the drive
// is image bytes, not base64 text (see `photoStore.ts`).

import type { ViewTransform } from "@niclaslindstedt/oss-framework/viewer";

import { exportFileStem } from "./export.ts";
import type { Contact, PhotoTransform } from "./types.ts";

// --- stored transform ⇄ framework viewer transform -----------------------------

/** The stored framing as the framework cropper's `ViewTransform` — the same
 *  resolution-independent numbers, with the app's `x`/`y` pan named `tx`/`ty`. */
export function toViewTransform(t: PhotoTransform): ViewTransform {
  return { scale: t.scale, tx: t.x, ty: t.y };
}

/** A framework `ViewTransform` back to the stored `PhotoTransform` shape —
 *  the inverse of {@link toViewTransform}, applied when a crop is saved. */
export function fromViewTransform(v: ViewTransform): PhotoTransform {
  return { scale: v.scale, x: v.tx, y: v.ty };
}

// --- deterministic file path -------------------------------------------------

/** A contact reference the deterministic photo paths are built from. */
type PhotoNamed = {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
};

/** A short, stable, human-friendly tag for a contact, derived from its id — the
 *  disambiguator that keeps two contacts who share a display name (hence the
 *  same slug) from colliding in the flat `photos/` folder. Four base36
 *  characters of a djb2 hash of the id: it depends only on the id, so it is
 *  stable across renames and photo reorders, and it stays short and readable in
 *  a file listing. */
export function contactTag(contactId: string): string {
  let h = 5381;
  for (let i = 0; i < contactId.length; i += 1) {
    h = (h * 33) ^ contactId.charCodeAt(i);
  }
  return (h >>> 0).toString(36).padStart(4, "0").slice(-4);
}

/** The file path a gallery photo's *display* crop is externalised to on a cloud
 *  backend: `photos/<name-slug>-<tag>-<index>.jpg`. Built from the display name
 *  (reusing the export filename slug), a short stable {@link contactTag}, and
 *  the photo's 1-based position in the gallery — so it is deterministic, unique
 *  across name collisions and across the several photos one card can carry,
 *  predictable enough to find by hand, and — as a real binary JPEG — easy to
 *  preview in the drive. The index means the primary photo is `…-1.jpg`, the
 *  next `…-2.jpg`, and so on. */
export function photoPathFor(contact: PhotoNamed, index: number): string {
  return `photos/${photoStem(contact)}-${index}.jpg`;
}

/** The file path a gallery photo's larger *source* original is externalised to:
 *  `photos/<name-slug>-<tag>-<index>-source.jpg`. Sits beside the display crop
 *  so a fresh device can re-open the cropper on the original. */
export function photoSourcePathFor(contact: PhotoNamed, index: number): string {
  return `photos/${photoStem(contact)}-${index}-source.jpg`;
}

function photoStem(contact: PhotoNamed): string {
  const stem = exportFileStem({
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    company: contact.company,
  } as Contact);
  return `${stem}-${contactTag(contact.id)}`;
}

/** What a filed photo path names: the contact it belongs to, whether it is the
 *  larger source original rather than the display crop, and — depending on the
 *  naming scheme — either the photo's 1-based gallery position (`index`, the
 *  current `<tag>-<index>` scheme) or the photo entry's own id (`photoId`, the
 *  legacy `<contactId>-<photoId>` scheme still found on drives filed by an
 *  older build). */
export type ParsedPhotoPath = {
  contactId: string;
  source: boolean;
  index?: number;
  photoId?: string;
};

/** Parse a filed photo path back to the contact + photo it belongs to — the
 *  inverse of {@link photoPathFor} / {@link photoSourcePathFor}, and the key to
 *  re-indexing "lost" photo files (see `photoStore.ts`).
 *
 *  Two schemes are recognised, both anchored on a *known* card so the cosmetic
 *  slug in front (which can itself contain hyphens) never has to be guessed at:
 *    - current — `photos/<slug>-<tag>-<index>[-source].jpg`, matched by finding
 *      the contact whose {@link contactTag} equals the file's tag; the trailing
 *      number is the photo's 1-based gallery position.
 *    - legacy — `photos/<slug>-<contactId>-<photoId>[-source].jpg`, matched by
 *      locating a known contact id inside the stem (how an older build filed
 *      photos, kept so those files still re-attach and get renamed).
 *
 *  A photo a user hand-drops into the drive is picked up under either scheme as
 *  long as its name carries a matching tag + index or contact id + photo id.
 *  Returns null when the path names no known contact. */
export function parsePhotoPath(
  path: string,
  contactIds: Iterable<string>,
): ParsedPhotoPath | null {
  const match = /^photos\/(.+?)(-source)?\.jpg$/i.exec(path);
  if (!match) return null;
  const stem = match[1]!;
  const source = match[2] != null;
  // A single pass materialises the ids so both scheme checks can scan them.
  const ids = Array.from(contactIds);

  // Current scheme: the stem ends `-<tag>-<index>`; accept it only when the tag
  // maps to a real card, so a slug that merely ends in four chars and a number
  // doesn't masquerade as one.
  const tagged = /^(.*)-([0-9a-z]{4})-(\d+)$/i.exec(stem);
  if (tagged) {
    const tag = tagged[2]!.toLowerCase();
    const index = Number(tagged[3]);
    for (const contactId of ids) {
      if (contactTag(contactId) === tag) {
        return { contactId, source, index };
      }
    }
  }

  // Legacy scheme: a known contact id sits between the slug and the photo id.
  for (const contactId of ids) {
    const marker = `-${contactId}-`;
    const at = stem.indexOf(marker);
    if (at === -1) continue;
    const photoId = stem.slice(at + marker.length);
    if (photoId.length === 0) continue;
    return { contactId, source, photoId };
  }
  return null;
}
