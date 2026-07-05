// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Turning a picked / dropped file into a contact {@link Attachment}. Unlike a
// photo (which is downscaled and re-encoded — see `photo.ts`), an attachment is
// kept byte-for-byte: a PDF menu or a scanned card must round-trip unchanged, so
// the file is read straight to a base64 `data:` URI. The framework owns the
// reading mechanics (`readFilesWithLimit`: FileReader, the size ceiling, the
// accepted/rejected partition); this shim only shapes the result into the app's
// `Attachment` records. The pure list mechanics live in `attachments.ts`.

import { readFilesWithLimit } from "@niclaslindstedt/oss-framework/files";

import { freshId } from "./useContactStore.ts";
import type { Attachment } from "./types.ts";

/** The largest file accepted as an attachment, in bytes. Attachments ride
 *  inside the document (and, on a cloud backend, are filed out as their own
 *  binary files), so an oversized upload is refused rather than silently
 *  overflowing the local storage quota. 10 MB comfortably covers a menu PDF or a
 *  photo of a document while staying a sane ceiling. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Why a file couldn't be attached — surfaced so the UI can tell the user
 *  rather than dropping the file on the floor. */
export type AttachmentRejection = {
  name: string;
  reason: "too-large" | "read-failed";
};

/** The outcome of reading a batch of picked files: the attachments that were
 *  read, and any that were refused (too large / unreadable). */
export type AttachmentIntake = {
  attachments: Attachment[];
  rejected: AttachmentRejection[];
};

/** Read a batch of picked files, partitioning them into the ones that became
 *  attachments and the ones that were refused. */
export async function filesToAttachments(
  files: readonly File[],
): Promise<AttachmentIntake> {
  const { accepted, rejected } = await readFilesWithLimit(files, {
    maxBytes: MAX_ATTACHMENT_BYTES,
  });
  return {
    attachments: accepted.map((f) => ({
      id: freshId("attach"),
      name: f.name,
      mime: f.type,
      size: f.size,
      data: f.dataUrl,
    })),
    rejected: rejected.map(({ name, reason }) => ({ name, reason })),
  };
}
