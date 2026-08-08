// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The dev-seed *mode* vocabulary, split out from `fakeData.ts` so reading the
// `VITE_SEED` intent costs nothing at boot. `fakeData.ts` and `demoData.ts`
// carry tens of kB of sample cards that production users must never download,
// so nothing on the entry path may import them — only this file.

export type FakeSeedSize = "sample" | number;
export type DevDataMode = "off" | "fake" | "demo";
export type FakeSeedConfig = { mode: DevDataMode; size: FakeSeedSize };

export const LARGE_SEED_COUNT = 250;

export function parseSeedEnv(raw: string | undefined | null): FakeSeedConfig {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "off" || v === "no") {
    return { mode: "off", size: "sample" };
  }
  if (v === "demo") {
    return { mode: "demo", size: "sample" };
  }
  if (v === "large" || v === "xl" || v === "stress" || v === "max") {
    return { mode: "fake", size: LARGE_SEED_COUNT };
  }
  const n = Number(v);
  if (Number.isFinite(n) && n > 1) {
    return { mode: "fake", size: Math.floor(n) };
  }
  // "1", "true", "on", "yes", "sample", or any other truthy token.
  return { mode: "fake", size: "sample" };
}
