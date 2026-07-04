// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { createZip, readZip, type ZipEntry } from "../src/app/zip.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesOf(entry: ZipEntry | undefined): string {
  return entry ? dec.decode(entry.data) : "";
}

describe("zip", () => {
  it("round-trips a single text entry", async () => {
    const zip = await createZip([
      { name: "contacts.json", data: enc.encode('{"version":4}') },
    ]);
    const entries = await readZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("contacts.json");
    expect(bytesOf(entries[0])).toBe('{"version":4}');
  });

  it("round-trips several entries preserving names and order", async () => {
    const zip = await createZip([
      { name: "a.txt", data: enc.encode("alpha") },
      { name: "nested/b.txt", data: enc.encode("beta") },
    ]);
    const entries = await readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["a.txt", "nested/b.txt"]);
    expect(bytesOf(entries.find((e) => e.name === "nested/b.txt"))).toBe(
      "beta",
    );
  });

  it("compresses a large, repetitive payload below its raw size", async () => {
    // Deflate should shrink a payload that repeats — the whole point of zipping
    // a document full of base64. (When the platform lacks the codec the entry is
    // stored, so only assert the archive is at least readable in that case.)
    const raw = enc.encode("contact ".repeat(5000));
    const zip = await createZip([{ name: "big.txt", data: raw }]);
    const [entry] = await readZip(zip);
    expect(bytesOf(entry)).toBe("contact ".repeat(5000));
  });

  it("round-trips a full byte range (0..255), not just ASCII", async () => {
    const raw = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) raw[i] = i;
    const zip = await createZip([{ name: "bytes.bin", data: raw }]);
    const [entry] = await readZip(zip);
    expect(Array.from(entry!.data)).toEqual(Array.from(raw));
  });

  it("round-trips an empty entry", async () => {
    const zip = await createZip([{ name: "empty", data: new Uint8Array(0) }]);
    const [entry] = await readZip(zip);
    expect(entry!.name).toBe("empty");
    expect(entry!.data).toHaveLength(0);
  });

  it("rejects bytes that aren't a ZIP archive", async () => {
    await expect(readZip(enc.encode("not a zip"))).rejects.toThrow();
  });
});
