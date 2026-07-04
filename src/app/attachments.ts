// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The contact attachments list — one small module that owns "how the set of
// files on a card changes" so nothing else has to reach into the `attachments`
// array directly. It mirrors `contactPhotos.ts`: pure mutators that each take a
// contact and return the `Partial<Contact>` patch to feed `updateContact`, so
// an add / remove / describe is one undoable store step. New attachment ids are
// minted by the caller (the UI, via `freshId`) and passed in, keeping this
// module free of any id source and node-testable.

import type { Attachment, Contact } from "./types.ts";

/** A contact viewed only through its attachments — all these helpers need. */
type WithAttachments = Pick<Contact, "attachments">;

/** The attachment list as a plain array (never undefined), in stored order. */
export function attachmentList(c: WithAttachments): Attachment[] {
  return c.attachments ?? [];
}

/** How many attachments the card holds. */
export function attachmentCount(c: WithAttachments): number {
  return attachmentList(c).length;
}

/** Whether the card carries any attachment at all. */
export function hasAttachments(c: WithAttachments): boolean {
  return attachmentCount(c) > 0;
}

/** Whether an attachment is an image (drives the thumbnail vs. file-row
 *  choice). Reads the stored MIME type. */
export function isImageAttachment(a: Pick<Attachment, "mime">): boolean {
  return a.mime.startsWith("image/");
}

/** Whether an attachment can be shown inline in a new browser tab rather than
 *  only downloaded — images and PDFs. Everything else is offered as a download. */
export function isViewableAttachment(a: Pick<Attachment, "mime">): boolean {
  return isImageAttachment(a) || a.mime === "application/pdf";
}

/** Append an attachment to the card — the upload outcome. Kept in add order so
 *  the newest file lands at the end of the list. */
export function withAttachmentAdded(
  c: WithAttachments,
  attachment: Attachment,
): Partial<Contact> {
  return { attachments: [...attachmentList(c), attachment] };
}

/** Drop an attachment from the card. */
export function withAttachmentRemoved(
  c: WithAttachments,
  attachmentId: string,
): Partial<Contact> {
  return {
    attachments: attachmentList(c).filter((a) => a.id !== attachmentId),
  };
}

/** Patch one attachment's editable fields (its description) in place, keeping
 *  its id, bytes, and position untouched. */
export function withAttachmentUpdated(
  c: WithAttachments,
  attachmentId: string,
  patch: Partial<Pick<Attachment, "description">>,
): Partial<Contact> {
  return {
    attachments: attachmentList(c).map((a) =>
      a.id === attachmentId ? { ...a, ...patch } : a,
    ),
  };
}

/** A human-readable file size ("2.4 MB", "812 KB", "40 B") for the read-view
 *  badge. Falls back to an empty string when the size isn't known. */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded =
    value >= 10 || Number.isInteger(value)
      ? Math.round(value)
      : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}
