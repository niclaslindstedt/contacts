// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  attachmentCount,
  attachmentList,
  formatFileSize,
  hasAttachments,
  isImageAttachment,
  isViewableAttachment,
  withAttachmentAdded,
  withAttachmentRemoved,
  withAttachmentUpdated,
} from "../src/app/attachments.ts";
import type { Attachment, Contact } from "../src/app/types.ts";

function att(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: "a1",
    name: "menu.pdf",
    mime: "application/pdf",
    ...overrides,
  };
}

function card(attachments?: Attachment[]): Contact {
  return {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
    folderId: null,
    ...(attachments ? { attachments } : {}),
  };
}

describe("attachment accessors", () => {
  it("treats an absent list as empty", () => {
    const c = card();
    expect(attachmentList(c)).toEqual([]);
    expect(attachmentCount(c)).toBe(0);
    expect(hasAttachments(c)).toBe(false);
  });

  it("reports a populated list", () => {
    const c = card([att()]);
    expect(attachmentCount(c)).toBe(1);
    expect(hasAttachments(c)).toBe(true);
  });
});

describe("isImageAttachment / isViewableAttachment", () => {
  it("recognises images by MIME prefix", () => {
    expect(isImageAttachment(att({ mime: "image/png" }))).toBe(true);
    expect(isImageAttachment(att({ mime: "application/pdf" }))).toBe(false);
  });

  it("treats images and PDFs as viewable, others as not", () => {
    expect(isViewableAttachment(att({ mime: "image/jpeg" }))).toBe(true);
    expect(isViewableAttachment(att({ mime: "application/pdf" }))).toBe(true);
    expect(
      isViewableAttachment(att({ mime: "application/octet-stream" })),
    ).toBe(false);
  });
});

describe("attachment mutators", () => {
  it("appends in add order", () => {
    const c = card([att({ id: "a1" })]);
    const patch = withAttachmentAdded(c, att({ id: "a2", name: "map.png" }));
    expect(patch.attachments?.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("removes by id", () => {
    const c = card([att({ id: "a1" }), att({ id: "a2" })]);
    const patch = withAttachmentRemoved(c, "a1");
    expect(patch.attachments?.map((a) => a.id)).toEqual(["a2"]);
  });

  it("updates the description in place, keeping id and order", () => {
    const c = card([att({ id: "a1" }), att({ id: "a2" })]);
    const patch = withAttachmentUpdated(c, "a2", { description: "Lunch menu" });
    expect(patch.attachments?.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(patch.attachments?.[1]?.description).toBe("Lunch menu");
    expect(patch.attachments?.[0]?.description).toBeUndefined();
  });
});

describe("formatFileSize", () => {
  it("formats bytes, KB, MB", () => {
    expect(formatFileSize(40)).toBe("40 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1_500_000)).toBe("1.4 MB");
  });

  it("returns empty for an unknown size", () => {
    expect(formatFileSize(undefined)).toBe("");
    expect(formatFileSize(-1)).toBe("");
  });
});
