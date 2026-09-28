// The guard both app bundle scripts run over their webroot
// (`scripts/website-only.mjs`), driven through its command line: a webroot
// is refused when it carries what only the website may.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = join(import.meta.dirname, "..", "scripts", "website-only.mjs");

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function webroot(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), "contacts-webroot-"));
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

function check(root: string): { ok: boolean; output: string } {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, root], {
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, VITE_DONATE_URL: "" },
    });
    return { ok: true, output: out };
  } catch (error) {
    const e = error as { stderr?: string };
    return { ok: false, output: e.stderr ?? "" };
  }
}

describe("website-only guard", () => {
  it("passes an app webroot", () => {
    const result = check(
      webroot({ "index.html": "<!doctype html>", "version.json": "{}" }),
    );
    expect(result.ok).toBe(true);
  });

  it("refuses a service worker", () => {
    const result = check(
      webroot({ "index.html": "<!doctype html>", "sw.js": "self.skip()" }),
    );
    expect(result.ok).toBe(false);
    expect(result.output).toContain("sw.js is a service worker");
  });

  it("refuses a link back to the source", () => {
    const result = check(
      webroot({ "index.html": "https://github.com/niclaslindstedt/contacts" }),
    );
    expect(result.ok).toBe(false);
    expect(result.output).toContain("a link back to the source");
  });
});
