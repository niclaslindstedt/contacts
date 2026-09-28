// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Opening a contact attachment from the read view. A viewable file (a PDF) opens
// in a new browser tab; anything else is saved. Images aren't handled here —
// they open in the in-app lightbox (the framework `Lightbox` the profile photos
// use). The framework helpers turn the stored `data:` URL into a real Blob first
// so the browser gets a genuine PDF/octet-stream rather than a giant `data:`
// URL, which some browsers refuse to navigate to; these shims only supply the
// attachment-flavoured fallbacks (stored MIME type, file name).
//
// A shell with the `save-file` capability (the phone app) has no tabs to open:
// there every attachment goes to the share sheet, whose preview shows a PDF.

import { openDataUrlInTab } from "@niclaslindstedt/oss-framework/files";
import { nativeShellCan } from "@niclaslindstedt/oss-framework/pwa";

import { isViewableAttachment } from "./attachments.ts";
import { saveDataUrlExport } from "./saveExport.ts";
import type { Attachment } from "./types.ts";

/** Whether tapping the attachment opens it in a new tab (rather than saving
 *  it): a viewable file, where there are tabs to open. */
export function opensInTab(a: Pick<Attachment, "mime">): boolean {
  return isViewableAttachment(a) && !nativeShellCan("save-file");
}

/** Open a viewable attachment (a PDF) in a new tab. Returns false when the
 *  bytes couldn't be prepared (e.g. not yet re-hydrated from a cloud file), so
 *  the caller can fall back to saving it. */
export function openAttachment(a: Attachment): boolean {
  return openDataUrlInTab(a.data, a.mime || undefined);
}

/** Save an attachment's bytes under its original file name — a download, or
 *  the share sheet in the phone app. Returns false when the bytes couldn't be
 *  prepared. */
export function downloadAttachment(a: Attachment): boolean {
  return saveDataUrlExport(a.name || "attachment", a.data, a.mime || undefined);
}
