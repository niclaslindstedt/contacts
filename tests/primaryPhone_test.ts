// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { primaryPhone, withPrimaryPhone } from "../src/app/primaryPhone.ts";
import type { Phone } from "../src/app/types.ts";

const phones: Phone[] = [
  { id: "a", value: "111", label: "private" },
  { id: "b", value: "222", label: "work" },
  { id: "c", value: "333" },
];

describe("primaryPhone", () => {
  it("returns the flagged number", () => {
    const flagged = phones.map((p) =>
      p.id === "b" ? { ...p, primary: true } : p,
    );
    expect(primaryPhone(flagged)?.id).toBe("b");
  });

  it("returns undefined when no number is flagged", () => {
    expect(primaryPhone(phones)).toBeUndefined();
  });

  it("ignores a flagged number with no value", () => {
    const empty: Phone[] = [{ id: "a", value: "  ", primary: true }];
    expect(primaryPhone(empty)).toBeUndefined();
  });

  it("resolves to the first when several are flagged (defensive)", () => {
    const many = phones.map((p) =>
      p.id === "a" || p.id === "c" ? { ...p, primary: true } : p,
    );
    expect(primaryPhone(many)?.id).toBe("a");
  });
});

describe("withPrimaryPhone", () => {
  it("flags one row and clears every other", () => {
    const seeded = phones.map((p) =>
      p.id === "a" ? { ...p, primary: true } : p,
    );
    const next = withPrimaryPhone(seeded, "b");
    expect(next.find((p) => p.id === "a")?.primary).toBeUndefined();
    expect(next.find((p) => p.id === "b")?.primary).toBe(true);
    expect(next.find((p) => p.id === "c")?.primary).toBeUndefined();
  });

  it("clears every flag when id is null", () => {
    const seeded = phones.map((p) =>
      p.id === "b" ? { ...p, primary: true } : p,
    );
    const next = withPrimaryPhone(seeded, null);
    expect(next.some((p) => p.primary)).toBe(false);
  });

  it("drops the flag key rather than storing false", () => {
    const seeded = phones.map((p) =>
      p.id === "b" ? { ...p, primary: true } : p,
    );
    const cleared = withPrimaryPhone(seeded, "a");
    expect("primary" in cleared.find((p) => p.id === "b")!).toBe(false);
  });

  it("leaves untouched rows referentially the same", () => {
    const next = withPrimaryPhone(phones, "b");
    // Rows that neither gain nor lose the flag are returned as-is.
    expect(next.find((p) => p.id === "c")).toBe(phones[2]);
  });
});
