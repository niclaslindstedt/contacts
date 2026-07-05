// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Opening a contact attachment from the read view. A viewable file (a PDF) opens
// in a new browser tab; anything else is saved to disk. Images aren't handled
// here — they open in the in-app lightbox (the framework `Lightbox` the profile
// photos use). The framework helpers turn the stored `data:` URL into a real
// Blob first so the browser gets a genuine PDF/octet-stream rather than a giant
// `data:` URL, which some browsers refuse to navigate to; these shims only
// supply the attachment-flavoured fallbacks (stored MIME type, file name).

import {
  openDataUrlInTab,
  saveDataUrl,
} from "@niclaslindstedt/oss-framework/files";

import type { Attachment } from "./types.ts";

/** Open a viewable attachment (a PDF) in a new tab. Returns false when the
 *  bytes couldn't be prepared (e.g. not yet re-hydrated from a cloud file), so
 *  the caller can fall back to a download. */
export function openAttachment(a: Attachment): boolean {
  return openDataUrlInTab(a.data, a.mime || undefined);
}

/** Save an attachment's bytes to disk under its original file name. Returns
 *  false when the bytes couldn't be prepared. */
export function downloadAttachment(a: Attachment): boolean {
  return saveDataUrl(a.name || "attachment", a.data, a.mime || undefined);
}
