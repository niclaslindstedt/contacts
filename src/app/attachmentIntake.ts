// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Turning a picked / dropped file into a contact {@link Attachment}. Unlike a
// photo (which is downscaled and re-encoded — see `photo.ts`), an attachment is
// kept byte-for-byte: a PDF menu or a scanned card must round-trip unchanged, so
// the file is read straight to a base64 `data:` URI. This is the DOM half of the
// feature (FileReader); the pure list mechanics live in `attachments.ts`.

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

/** Read one file into a base64 `data:` URI, preserving its exact bytes. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Read a single picked file into an {@link Attachment}, or reject it when it's
 *  too large / unreadable. The MIME type falls back to a generic octet-stream so
 *  an extension-less file still round-trips. */
export async function fileToAttachment(
  file: File,
): Promise<{ attachment: Attachment } | { rejected: AttachmentRejection }> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { rejected: { name: file.name, reason: "too-large" } };
  }
  try {
    const data = await readAsDataUrl(file);
    return {
      attachment: {
        id: freshId("attach"),
        name: file.name || "file",
        mime: file.type || "application/octet-stream",
        size: file.size,
        data,
      },
    };
  } catch {
    return { rejected: { name: file.name, reason: "read-failed" } };
  }
}

/** Read a batch of picked files, partitioning them into the ones that became
 *  attachments and the ones that were refused. */
export async function filesToAttachments(
  files: readonly File[],
): Promise<AttachmentIntake> {
  const results = await Promise.all(files.map(fileToAttachment));
  const attachments: Attachment[] = [];
  const rejected: AttachmentRejection[] = [];
  for (const r of results) {
    if ("attachment" in r) attachments.push(r.attachment);
    else rejected.push(r.rejected);
  }
  return { attachments, rejected };
}
