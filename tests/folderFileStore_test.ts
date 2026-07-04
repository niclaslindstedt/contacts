// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it, vi } from "vitest";

import {
  folderFileStore,
  isFolderPermissionError,
} from "../src/app/folderFileStore.ts";
import { folderPhotoStore } from "../src/app/photoStore.ts";
import { folderAttachmentStore } from "../src/app/attachmentStore.ts";

// A minimal in-memory stand-in for the File System Access API directory tree,
// enough to exercise the byte-level folder store: nested directories, binary
// files, recursive iteration, and removal. Mirrors the handles the real store
// drives (`getDirectoryHandle`, `getFileHandle`, `createWritable`, `getFile`,
// `removeEntry`, `values`).

class MockFileHandle {
  readonly kind = "file";
  bytes = new Uint8Array();
  constructor(readonly name: string) {}
  async getFile() {
    const bytes = this.bytes;
    return {
      lastModified: 0,
      async arrayBuffer() {
        return bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        );
      },
    };
  }
  async createWritable() {
    const self = this;
    return {
      async write(data: BufferSource) {
        self.bytes =
          data instanceof Uint8Array
            ? new Uint8Array(data)
            : new Uint8Array(data as ArrayBuffer);
      },
      async close() {},
    };
  }
}

class MockDirHandle {
  readonly kind = "directory";
  readonly children = new Map<string, MockFileHandle | MockDirHandle>();
  constructor(readonly name: string) {}
  async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
    let h = this.children.get(name);
    if (!h) {
      if (!opts?.create) throw new DOMException("missing", "NotFoundError");
      h = new MockDirHandle(name);
      this.children.set(name, h);
    }
    if (h.kind !== "directory")
      throw new DOMException("not a dir", "TypeMismatchError");
    return h as unknown as FileSystemDirectoryHandle;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    let h = this.children.get(name);
    if (!h) {
      if (!opts?.create) throw new DOMException("missing", "NotFoundError");
      h = new MockFileHandle(name);
      this.children.set(name, h);
    }
    return h as unknown as FileSystemFileHandle;
  }
  async removeEntry(name: string) {
    if (!this.children.has(name))
      throw new DOMException("missing", "NotFoundError");
    this.children.delete(name);
  }
  async *values() {
    for (const child of this.children.values()) {
      yield child as unknown as
        FileSystemFileHandle | FileSystemDirectoryHandle;
    }
  }
}

function root(): FileSystemDirectoryHandle {
  return new MockDirHandle("Contacts") as unknown as FileSystemDirectoryHandle;
}

const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array | null) =>
  b === null ? null : new TextDecoder().decode(b);

describe("folderFileStore", () => {
  it("writes bytes into nested directories and reads them back verbatim", async () => {
    const store = folderFileStore(root());
    await store.write("photos/ada-c1-p1.jpg", bytes("JPEGDATA"));
    expect(text(await store.read("photos/ada-c1-p1.jpg"))).toBe("JPEGDATA");
  });

  it("returns null reading a path that does not exist", async () => {
    const store = folderFileStore(root());
    expect(await store.read("photos/missing.jpg")).toBeNull();
    // A missing intermediate directory also resolves to null, not a throw.
    expect(await store.read("attachments/none.pdf")).toBeNull();
  });

  it("lists every file recursively as a full slash-separated path", async () => {
    const store = folderFileStore(root());
    await store.write("photos/a.jpg", bytes("a"));
    await store.write("photos/deep/b.jpg", bytes("b"));
    await store.write("attachments/c.pdf", bytes("c"));
    await store.write("contacts-default.json", bytes("{}"));

    const listed = (await store.list()).sort();
    expect(listed).toEqual(
      [
        "attachments/c.pdf",
        "contacts-default.json",
        "photos/a.jpg",
        "photos/deep/b.jpg",
      ].sort(),
    );
  });

  it("overwrites an existing file's bytes", async () => {
    const store = folderFileStore(root());
    await store.write("photos/a.jpg", bytes("first"));
    await store.write("photos/a.jpg", bytes("second"));
    expect(text(await store.read("photos/a.jpg"))).toBe("second");
  });

  it("removes a file, and treats removing a missing file as a no-op", async () => {
    const store = folderFileStore(root());
    await store.write("photos/a.jpg", bytes("a"));
    await store.remove("photos/a.jpg");
    expect(await store.read("photos/a.jpg")).toBeNull();
    // No throw for a path that isn't there.
    await expect(store.remove("photos/gone.jpg")).resolves.toBeUndefined();
  });

  it("fires onPermissionLost when an operation hits a revoked grant", async () => {
    const dir = new MockDirHandle("Contacts");
    // Simulate the OS revoking the grant: any write now throws NotAllowedError.
    dir.getFileHandle = async () => {
      throw new DOMException("revoked", "NotAllowedError");
    };
    const onLost = vi.fn();
    const store = folderFileStore(
      dir as unknown as FileSystemDirectoryHandle,
      onLost,
    );
    // A root-level path so the overridden `getFileHandle` on the root is hit.
    await expect(store.write("a.jpg", bytes("a"))).rejects.toThrow();
    expect(onLost).toHaveBeenCalledOnce();
  });
});

describe("folderPhotoStore / folderAttachmentStore scoping", () => {
  it("each store lists only files in its own subtree over one shared handle", async () => {
    const dir = root();
    const photos = folderPhotoStore(dir);
    const attachments = folderAttachmentStore(dir);
    const raw = folderFileStore(dir);

    await raw.write("contacts-default.json", bytes("{}"));
    await photos.write("photos/ada-c1-p1.jpg", bytes("jpeg"));
    await attachments.write("attachments/ada-c1-a1.pdf", bytes("pdf"), "x/pdf");

    expect(await photos.list()).toEqual(["photos/ada-c1-p1.jpg"]);
    expect(await attachments.list()).toEqual(["attachments/ada-c1-a1.pdf"]);
    // The bytes round-trip through the shared directory handle.
    expect(text(await photos.read("photos/ada-c1-p1.jpg"))).toBe("jpeg");
    expect(text(await attachments.read("attachments/ada-c1-a1.pdf"))).toBe(
      "pdf",
    );
  });
});

describe("isFolderPermissionError", () => {
  it("recognises the revoked-grant DOMExceptions and nothing else", () => {
    expect(
      isFolderPermissionError(new DOMException("x", "NotAllowedError")),
    ).toBe(true);
    expect(
      isFolderPermissionError(new DOMException("x", "SecurityError")),
    ).toBe(true);
    expect(
      isFolderPermissionError(new DOMException("x", "NotFoundError")),
    ).toBe(false);
    expect(isFolderPermissionError(new Error("nope"))).toBe(false);
  });
});
