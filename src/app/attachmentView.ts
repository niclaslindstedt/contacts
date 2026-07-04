// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Opening a contact attachment from the read view. A viewable file (a PDF) opens
// in a new browser tab; anything else is saved to disk. Images aren't handled
// here — they open in the in-app lightbox (the same `PhotoViewer` the profile
// photos use). The bytes are turned into a real Blob first so the browser gets a
// genuine PDF/octet-stream rather than a giant `data:` URL, which some browsers
// refuse to navigate to.

import { downloadBlob } from "./download.ts";
import { dataUrlToBytes } from "./photo.ts";
import type { Attachment } from "./types.ts";

/** The attachment's bytes as a Blob tagged with its stored MIME type, or null
 *  when the bytes aren't present / decodable (e.g. not yet re-hydrated from a
 *  cloud file). */
function toBlob(a: Attachment): Blob | null {
  const parsed = dataUrlToBytes(a.data);
  if (!parsed) return null;
  return new Blob([parsed.bytes as BlobPart], { type: a.mime || parsed.mime });
}

/** Open a viewable attachment (a PDF) in a new tab. Returns false when the bytes
 *  couldn't be prepared, so the caller can fall back to a download. The object
 *  URL is revoked after a grace period so the opened tab has time to load it. */
export function openAttachment(a: Attachment): boolean {
  const blob = toBlob(a);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Revoke late so the new tab can finish loading; if the popup was blocked
  // there's nothing to load and the timeout just cleans up.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Save an attachment's bytes to disk under its original file name. Returns
 *  false when the bytes couldn't be prepared. */
export function downloadAttachment(a: Attachment): boolean {
  const blob = toBlob(a);
  if (!blob) return false;
  downloadBlob(a.name || "attachment", blob);
  return true;
}
