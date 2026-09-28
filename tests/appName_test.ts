import { describe, expect, it } from "vitest";

import { PROJECT_NAME, resolveAppName } from "../src/app/appName.ts";

describe("resolveAppName", () => {
  it("gives the phone build its store listing's name", () => {
    expect(resolveAppName(true, "Store Name")).toBe("Store Name");
    expect(resolveAppName(true, "  Store Name  ")).toBe("Store Name");
  });

  it("keeps the project's name in a phone build with nothing set", () => {
    expect(resolveAppName(true, undefined)).toBe(PROJECT_NAME);
    expect(resolveAppName(true, "  ")).toBe(PROJECT_NAME);
  });

  it("never lets the listing name reach the website or the desktop app", () => {
    expect(resolveAppName(false, "Store Name")).toBe(PROJECT_NAME);
  });
});
