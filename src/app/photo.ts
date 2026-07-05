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

/** The file path a gallery photo's *display* crop is externalised to on a cloud
 *  backend: `photos/<name-slug>-<contactId>-<photoId>.jpg`. Built from the
 *  display name (reusing the export filename slug), the stable contact id, and
 *  the photo's own id, so it is deterministic, unique across name collisions and
 *  across the several photos one card can carry, and — as a real binary JPEG —
 *  easy to preview in the drive. */
export function photoPathFor(contact: PhotoNamed, photoId: string): string {
  return `photos/${photoStem(contact)}-${photoId}.jpg`;
}

/** The file path a gallery photo's larger *source* original is externalised to:
 *  `photos/<name-slug>-<contactId>-<photoId>-source.jpg`. Sits beside the
 *  display crop so a fresh device can re-open the cropper on the original. */
export function photoSourcePathFor(
  contact: PhotoNamed,
  photoId: string,
): string {
  return `photos/${photoStem(contact)}-${photoId}-source.jpg`;
}

function photoStem(contact: PhotoNamed): string {
  const stem = exportFileStem({
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    company: contact.company,
  } as Contact);
  return `${stem}-${contact.id}`;
}

/** What a filed photo path names: the contact it belongs to, the photo's own
 *  id, and whether it is the larger source original rather than the display
 *  crop. */
export type ParsedPhotoPath = {
  contactId: string;
  photoId: string;
  source: boolean;
};

/** Parse a filed photo path back to the contact + photo it belongs to — the
 *  inverse of {@link photoPathFor} / {@link photoSourcePathFor}, and the key to
 *  re-indexing "lost" photo files (see `photoStore.ts`).
 *
 *  The filename is `photos/<name-slug>-<contactId>-<photoId>[-source].jpg`. The
 *  leading `<name-slug>` is cosmetic — a human-readable label that can itself
 *  contain hyphens — so rather than guess where it ends, the parse anchors on a
 *  *known* contact id: the one segment that must line up with a real card. That
 *  makes it robust to a slug that no longer matches a renamed contact, and means
 *  a photo a user hand-drops into the drive is picked up as long as its name
 *  carries the right `-<contactId>-` and a non-empty photo id after it — the
 *  slug in front can be anything readable. Returns null when the path names no
 *  known contact. */
export function parsePhotoPath(
  path: string,
  contactIds: Iterable<string>,
): ParsedPhotoPath | null {
  const match = /^photos\/(.+?)(-source)?\.jpg$/i.exec(path);
  if (!match) return null;
  const stem = match[1]!;
  const source = match[2] != null;
  for (const contactId of contactIds) {
    const marker = `-${contactId}-`;
    const at = stem.indexOf(marker);
    if (at === -1) continue;
    const photoId = stem.slice(at + marker.length);
    if (photoId.length === 0) continue;
    return { contactId, photoId, source };
  }
  return null;
}
