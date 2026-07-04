// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import type { StorageAdapter } from "@niclaslindstedt/oss-framework/storage";

import {
  attachmentPathFor,
  withExternalAttachments,
  type AttachmentStore,
} from "../src/app/attachmentStore.ts";

// "Hello" as a base64 data URI — a stand-in for an attachment's bytes.
const HELLO = "data:application/pdf;base64,SGVsbG8=";

/** A fake byte store backed by a Map, plus a `mimes` log so a test can assert
 *  the content type a file was written with. */
function fakeStore() {
  const files = new Map<string, Uint8Array>();
  const mimes = new Map<string, string | undefined>();
  const store: AttachmentStore = {
    async list() {
      return [...files.keys()];
    },
    async read(path) {
      return files.get(path) ?? null;
    },
    async write(path, bytes, mime) {
      files.set(path, bytes);
      mimes.set(path, mime);
    },
    async remove(path) {
      files.delete(path);
    },
  };
  return { store, files, mimes };
}

/** A minimal in-memory inner adapter: `save` keeps the last text, `load` returns
 *  it. Enough for the externaliser to wrap. */
function fakeInner() {
  const state = { text: null as string | null };
  const adapter = {
    id: "test",
    label: "Test",
    async load() {
      return state.text === null ? null : { text: state.text, revision: "r1" };
    },
    async save(text: string) {
      state.text = text;
      return { revision: "r2" };
    },
  };
  return { adapter: adapter as unknown as StorageAdapter, state };
}

function docWith(attachment: object): string {
  return JSON.stringify({
    version: 4,
    folders: [],
    activeContactId: "c1",
    contacts: [
      {
        id: "c1",
        firstName: "Ada",
        lastName: "Lovelace",
        phones: [],
        emails: [],
        addresses: [],
        importantDates: [],
        folderId: null,
        attachments: [attachment],
      },
    ],
  });
}

describe("attachmentPathFor", () => {
  it("builds a deterministic path with the name slug, ids, and extension", () => {
    const path = attachmentPathFor(
      { id: "c1", firstName: "Ada", lastName: "Lovelace" },
      { id: "a1", name: "menu.pdf", mime: "application/pdf" },
    );
    expect(path).toBe("attachments/ada-lovelace-c1-a1.pdf");
  });

  it("derives the extension from the MIME type when the name has none", () => {
    const path = attachmentPathFor(
      { id: "c1", firstName: "Ada", lastName: "Lovelace" },
      { id: "a1", name: "scan", mime: "image/png" },
    );
    expect(path).toBe("attachments/ada-lovelace-c1-a1.png");
  });
});

describe("withExternalAttachments", () => {
  it("files bytes out on save and strips them from the stored document", async () => {
    const { adapter: inner, state } = fakeInner();
    const { store, files, mimes } = fakeStore();
    const wrapped = withExternalAttachments(inner, store);

    await wrapped.save(
      docWith({
        id: "a1",
        name: "menu.pdf",
        mime: "application/pdf",
        data: HELLO,
      }),
      undefined,
    );

    const path = "attachments/ada-lovelace-c1-a1.pdf";
    expect(files.has(path)).toBe(true);
    expect(mimes.get(path)).toBe("application/pdf");
    // The stored document carries the path, not the bytes.
    const stored = JSON.parse(state.text!);
    const entry = stored.contacts[0].attachments[0];
    expect(entry.data).toBeUndefined();
    expect(entry.dataPath).toBe(path);
  });

  it("re-hydrates the bytes on load using the stored MIME type", async () => {
    const { adapter: inner } = fakeInner();
    const { store } = fakeStore();
    const wrapped = withExternalAttachments(inner, store);

    // Save (files out), then load (should re-inline).
    await wrapped.save(
      docWith({
        id: "a1",
        name: "menu.pdf",
        mime: "application/pdf",
        data: HELLO,
      }),
      undefined,
    );
    const snap = await wrapped.load();
    const entry = JSON.parse(snap!.text).contacts[0].attachments[0];
    expect(entry.data).toBe(HELLO);
  });

  it("prunes files no surviving attachment references", async () => {
    const { adapter: inner } = fakeInner();
    const { store, files } = fakeStore();
    const wrapped = withExternalAttachments(inner, store);

    await wrapped.save(
      docWith({
        id: "a1",
        name: "menu.pdf",
        mime: "application/pdf",
        data: HELLO,
      }),
      undefined,
    );
    expect(files.size).toBe(1);

    // Save a document that no longer holds the attachment — its file is pruned.
    await wrapped.save(
      JSON.stringify({
        version: 4,
        folders: [],
        activeContactId: "c1",
        contacts: [
          {
            id: "c1",
            firstName: "Ada",
            lastName: "Lovelace",
            phones: [],
            emails: [],
            addresses: [],
            importantDates: [],
            folderId: null,
            attachments: [],
          },
        ],
      }),
      undefined,
    );
    expect(files.size).toBe(0);
  });

  it("keeps an undecodable attachment inline rather than losing it", async () => {
    const { adapter: inner, state } = fakeInner();
    const { store, files } = fakeStore();
    const wrapped = withExternalAttachments(inner, store);

    await wrapped.save(
      docWith({
        id: "a1",
        name: "x",
        mime: "text/plain",
        data: "not-a-data-uri",
      }),
      undefined,
    );
    expect(files.size).toBe(0);
    const entry = JSON.parse(state.text!).contacts[0].attachments[0];
    expect(entry.data).toBe("not-a-data-uri");
  });
});
