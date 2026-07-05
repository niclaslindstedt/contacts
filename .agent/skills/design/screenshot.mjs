// Iterative design screenshot harness. The `recipe` block near the end
// of this file is the only thing an agent edits per iteration — the
// helpers above are stable building blocks for common app flows.
//
// REQUIRES PLAYWRIGHT (not a dependency of this repo). The harness
// resolves `chromium` from whichever of `playwright`, `@playwright/test`,
// or `playwright-core` is installed. Install one before the first run:
//
//   npm i -D playwright-core          # lightest; the browser is
//                                     # preinstalled in web sessions
//   # or, on a normal dev machine that has no browser yet:
//   npm i -D @playwright/test && npx playwright install chromium
//
// In Claude Code web sessions a Chromium build ships under
// PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers); `launchBrowser` finds it
// automatically, so `npm i -D playwright-core` is all that's needed there.
//
// Run (leave the dev server running — it seeds fake data via VITE_SEED):
//
//   npm run dev &                              # http://localhost:5173/
//   node .agent/skills/design/screenshot.mjs   # captures the recipe at every viewport
//
// Then `Read` the PNGs written under /tmp/design-*.png, tweak code,
// rerun. Vite HMR picks up edits without a rebuild so each loop is
// ~1-2s once the dev server is warm.
//
// CLI flags (all optional, sensible defaults):
//
//   --base-url <url>    Where the app is served (default
//                       http://localhost:5173/, falls back to the vite
//                       preview server on 4173).
//   --out <dir>         Output directory (default /tmp).
//   --name <prefix>     Filename prefix (default "design").
//   --viewports <list>  Comma-separated subset of
//                       desktop,mobile,mobile-landscape,tablet
//                       (default desktop,mobile).

import { mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// === PLAYWRIGHT RESOLUTION (don't edit) ===

// Import `chromium` from whichever Playwright package is installed, so
// the skill works whether the repo pulled in the full `playwright`, the
// test runner, or just `playwright-core`.
async function loadChromium() {
  for (const mod of ["playwright", "@playwright/test", "playwright-core"]) {
    try {
      const m = await import(mod);
      if (m.chromium) return m.chromium;
    } catch {
      // Not installed — try the next candidate.
    }
  }
  throw new Error(
    "Playwright is not installed. Run `npm i -D playwright-core` " +
      "(the browser is preinstalled in web sessions), or " +
      "`npm i -D @playwright/test && npx playwright install chromium`.",
  );
}

// Find the Chromium binary preinstalled under PLAYWRIGHT_BROWSERS_PATH
// (web sessions ship one at /opt/pw-browsers). Returns null when there is
// none, so `launchBrowser` can fall back to Playwright's own resolution.
async function findPreinstalledChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(root)) return null;
  let entries;
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }
  for (const name of entries.sort().reverse()) {
    if (!name.startsWith("chromium-")) continue;
    const exe = join(root, name, "chrome-linux", "chrome");
    if (existsSync(exe)) return exe;
  }
  return null;
}

// Launch Chromium: prefer Playwright's own managed browser; if that
// throws (browsers not downloaded — common in web sessions where the
// binary lives outside Playwright's cache), retry with the preinstalled
// executable and the sandbox off (required when running as root).
async function launchBrowser(chromium) {
  try {
    return await chromium.launch();
  } catch (err) {
    const executablePath = await findPreinstalledChromium();
    if (!executablePath) throw err;
    return chromium.launch({ executablePath, args: ["--no-sandbox"] });
  }
}

// === HELPERS (don't edit — these stay stable across recipes) ===

// Playwright's `newContext` takes `viewport: { width, height }` as a
// nested object — passing `width` / `height` at the top level is a
// silent no-op and lands on the default desktop size. Every entry here
// is shaped for direct spread into the context options.
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  // iPhone 12 viewport (390 × 844) — the app's `sm` breakpoint sits at
  // 640px, so this reliably renders the mobile (drawer) layout. hasTouch
  // / isMobile flipped so touch interactions and mobile media queries
  // both apply.
  mobile: {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
  "mobile-landscape": {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  },
  // iPad mini portrait — past the 640px breakpoint, so the sidebar docks
  // (desktop-ish layout) but at a narrow width where overrides show.
  tablet: {
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
    isMobile: true,
  },
};

// Land on the app and wait until the shell has rendered. The app has no
// auth gate; `npm run dev` seeds fake contacts (VITE_SEED), so the app
// comes up on a populated address book landing on the List page.
// Waits for the List heading (the desktop landing state) or, on layouts
// that come up elsewhere, a control present across every mode: the
// card's read-mode pencil ("Edit contact") or edit-mode check ("Done"),
// or the phone's "Open sidebar" floating button.
export async function openApp(page) {
  await page.goto("./");
  await page
    .getByRole("heading", { name: /^List$/ })
    .first()
    .or(
      page.getByRole("button", { name: /^(Edit contact|Done|Open sidebar)$/ }),
    )
    .first()
    .waitFor();
}

// Flip a ToggleRow / checkbox by its accessible name ("Company contact",
// "Emergency contact", …). The framework checkbox hides its real <input>
// as sr-only behind the painted glyph, so a normal click is intercepted —
// force the click through to the input.
export async function toggleRow(page, name) {
  const sw = page.getByRole("switch", { name });
  if (await sw.count()) return sw.first().click();
  await page.getByRole("checkbox", { name }).first().click({ force: true });
}

// Put the open contact card into edit mode (a no-op if it already is).
// Edit mode is where the appearance popover and the field form live.
export async function enterEditMode(page) {
  const pencil = page.getByRole("button", { name: /^Edit contact$/ }).first();
  if (await pencil.isVisible().catch(() => false)) {
    await pencil.click();
    await page
      .getByRole("button", { name: /^Done$/ })
      .first()
      .waitFor();
  }
}

// Ensure the side menu is reachable: on wide screens it is docked, so
// this is a no-op; on phones it opens the drawer via the floating
// "Open sidebar" button.
export async function openSidebar(page) {
  const newContact = page
    .getByRole("button", { name: /^New contact$/ })
    .first();
  if (await newContact.isVisible().catch(() => false)) return;
  const open = page.getByRole("button", { name: /^Open sidebar$/ }).first();
  if (await open.count()) {
    await open.click();
    await page
      .getByRole("button", { name: /^New contact$/ })
      .first()
      .waitFor();
  }
}

// Open the overview List page (all active contacts, grouped by folder)
// from the side menu's "List" bar button. Opens the drawer first on
// phones. Waits for the list header to render.
export async function openList(page) {
  await openSidebar(page);
  await page
    .getByRole("button", { name: /^List$/ })
    .first()
    .click();
  await page
    .getByRole("heading", { name: /^List$/ })
    .first()
    .waitFor();
}

// Open the Favorites page from the side-menu action grid. Same shape as
// `openList` — the button and the page heading share the "Favorites" name, so
// match the heading role to confirm the page (not the button) rendered.
export async function openFavorites(page) {
  await openSidebar(page);
  await page
    .getByRole("button", { name: /^Favorites$/ })
    .first()
    .click();
  await page
    .getByRole("heading", { name: /^Favorites$/ })
    .first()
    .waitFor();
}

// Create a fresh contact and land on its card. A brand-new contact opens
// straight in edit mode (see `ContactScreen` `isEmptyContact`), so this
// is also the entry point for designing the edit form and the appearance
// popover.
export async function newContact(page) {
  await openSidebar(page);
  await page
    .getByRole("button", { name: /^New contact$/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /contact photo and appearance/i })
    .first()
    .waitFor();
}

// Open the appearance popover (the Photo / Colour / Icon picker) on the
// open contact card. Ensures edit mode first, then taps the avatar.
export async function openAppearancePopover(page) {
  await enterEditMode(page);
  await page
    .getByRole("button", { name: /contact photo and appearance/i })
    .first()
    .click();
  await page
    .getByText(/^Photos?$/)
    .first()
    .waitFor();
}

// Open the circle photo cropper by uploading an image. Pass an absolute
// path to a local image file; defaults to a bundled PWA icon so a recipe
// can exercise the cropper with no fixture of its own.
export async function openPhotoCropper(
  page,
  imagePath = "public/icons/pwa-512-maskable.png",
) {
  await openAppearancePopover(page);
  // Target the popover's image input specifically — the page also carries
  // the accept-less vCard import input, which matches a bare
  // `input[type=file]` first.
  await page.setInputFiles('input[type=file][accept^="image"]', imagePath);
  await page
    .getByText(/^Position photo$/)
    .first()
    .waitFor();
}

// Open the Settings dialog from the side menu's footer.
export async function openSettings(page) {
  await openSidebar(page);
  await page
    .getByRole("button", { name: /^Settings$/ })
    .first()
    .click();
  await page.getByRole("dialog").first().waitFor();
}

// Open Settings and switch to a named tab (e.g. "Format", "Storage",
// "Developer"). The tabs aren't a tab strip — the header title button
// (`#settings-title`) opens a FloatingPanel menu of `menuitem`s. Target the
// title button by id: a plain `[aria-haspopup="menu"]` also matches sidebar
// controls sitting *behind* the modal backdrop, so the click gets intercepted.
export async function openSettingsTab(page, tabName) {
  await openSettings(page);
  await page.locator("#settings-title").click();
  await page.getByRole("menuitem", { name: tabName }).click();
  await page.waitForTimeout(150);
}

// Scroll the Settings dialog's tab body to the bottom (to shoot sections below
// the fold). Scoped to the dialog so it doesn't scroll the sidebar's own list.
export async function scrollSettingsToBottom(page) {
  await page
    .getByRole("dialog")
    .locator("div.overflow-y-auto")
    .first()
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForTimeout(150);
}

// Pop the local `npm run dev` Vite server, or fall back to the built
// preview server if dev is silent. The skill prefers dev for HMR speed.
async function resolveBaseUrl(explicit) {
  if (explicit) return explicit;
  const candidates = ["http://localhost:5173/", "http://localhost:4173/"];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(750) });
      if (res.ok || res.status === 304) return url;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    "No app server reachable. Start `npm run dev` (or `make build && npm run preview`) before running this script.",
  );
}

function parseArgs(argv) {
  const args = { out: "/tmp", name: "design", viewports: "desktop,mobile" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.indexOf("=");
    const [flag, inline] =
      eq === -1 ? [a, undefined] : [a.slice(0, eq), a.slice(eq + 1)];
    const value = inline ?? argv[++i];
    if (flag === "--base-url") args.baseUrl = value;
    else if (flag === "--out") args.out = value;
    else if (flag === "--name") args.name = value;
    else if (flag === "--viewports") args.viewports = value;
    else throw new Error(`Unknown flag: ${flag}`);
  }
  return args;
}

// === RECIPE (edit this per iteration) ===
//
// `recipe` runs once per viewport. It receives the page already pointed
// at the right base URL but otherwise empty — drive the UI however you
// need, ending in the visual state you want to inspect. The harness
// takes the screenshot for you after this returns.
//
// `viewport` is the key from VIEWPORTS so the recipe can branch on
// breakpoint (e.g. only exercise a mobile-only control).

async function recipe(page) {
  // Default: the seeded contact card with the appearance popover open,
  // so its Photos / Colour / Icon layout is on screen. Swap for
  // `openPhotoCropper(page)` to design the cropper, `openApp(page)` to
  // shoot the read-mode card, `openList(page)` / `openFavorites(page)` for
  // the overview pages, or `openSettings(page)` for the settings dialog.
  await openApp(page);
  await openAppearancePopover(page);
  await page.waitForTimeout(200);
}

// === RUN (don't edit) ===

async function main() {
  const args = parseArgs(process.argv);
  const chromium = await loadChromium();
  const baseURL = await resolveBaseUrl(args.baseUrl);
  if (!existsSync(args.out)) await mkdir(args.out, { recursive: true });
  const viewports = args.viewports.split(",").map((s) => s.trim());
  const browser = await launchBrowser(chromium);
  try {
    for (const viewport of viewports) {
      const spec = VIEWPORTS[viewport];
      if (!spec) {
        console.error(
          `Unknown viewport "${viewport}". Known: ${Object.keys(VIEWPORTS).join(", ")}`,
        );
        process.exitCode = 1;
        continue;
      }
      const ctx = await browser.newContext({ baseURL, ...spec });
      const page = await ctx.newPage();
      try {
        await recipe(page, viewport);
        const path = join(args.out, `${args.name}-${viewport}.png`);
        await page.screenshot({
          path,
          fullPage: viewport.startsWith("mobile") ? false : true,
        });
        console.log(path);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
