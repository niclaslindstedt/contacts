---
name: design
description: "Use whenever you are iterating on the look or layout of the contacts UI — tuning a CSS rule, building a dialog or popover, reworking the contact card, the side menu, or the photo cropper, or hunting a mobile-only regression. Walks an edit / reload / screenshot / inspect loop that uses the Read tool to view PNGs inline at every viewport (desktop, mobile, mobile-landscape, tablet). The harness drives the running vite dev server through reusable flows so each iteration only changes the bit that's being designed. Manual playbook — not part of the `maintenance` umbrella."
---

# Iterating on visual design

This app is a local-first, browser-only React PWA — the screens live
under `src/app/` (`ContactScreen`, `ContactIdentity`,
`ContactAppearancePopover`, `PhotoCropper`, `SideMenuContent`,
`SettingsModal`, …), over the framework's UI kit. Most layout bugs only
surface at specific viewports (a docked sidebar vs a phone drawer, a
popover that fits desktop but overflows a 390px screen, a modal footer
under the soft keyboard). Looking at the rendered pixels every iteration
is what makes "tuning the spacing" fast — without it the loop is "edit,
reload, switch to phone, scroll, sigh, swap back" and an hour disappears.

This skill ships a small harness at
`.agent/skills/design/screenshot.mjs` that:

- Connects to whatever app server is already running (`npm run dev` on
  port 5173 preferred; falls back to the vite preview server on 4173).
- Spins up Chromium contexts for desktop / mobile / mobile-landscape /
  tablet viewports as needed.
- Drives the UI through a per-iteration **recipe** the agent edits.
- Writes one PNG per viewport to `/tmp/design-<viewport>.png` so the
  next step is just `Read /tmp/design-mobile.png`.

The Read tool renders PNGs inline. That's the whole reason this skill is
fast — you can see every iteration without leaving the session.

> **Prerequisite:** the harness needs Playwright, which is deliberately
> **not** a dependency of this repo — no build/test/lint step uses it, so
> human contributors and CI stay lean.
>
> In Claude Code **web sessions** you get it for free: the SessionStart
> hook (`.claude/hooks/session-start.sh`) installs `playwright-core` in
> the background (`--no-save`, so `package.json` stays clean), and a
> Chromium build is already preinstalled under `PLAYWRIGHT_BROWSERS_PATH`
> (`/opt/pw-browsers`) which the harness finds automatically. So a web
> session normally needs no setup — if the first run races the background
> install, wait a moment and rerun (or install it by hand with
> `npm i --no-save playwright-core`).
>
> On a **local machine** with no browser yet, install both once:
> `npm i -D @playwright/test && npx playwright install chromium`. The
> harness resolves `chromium` from whichever of `playwright` /
> `@playwright/test` / `playwright-core` is present.

## When to invoke

Invoke whenever you are about to change something visible and you'd
benefit from comparing renders across iterations:

- Tuning padding, gap, radius, colour on a surface you can navigate to
  (the contact card's read/edit body, a read-mode row, the side menu).
- Building or reworking a dialog / popover and want to confirm it looks
  right at every breakpoint before declaring it done (the appearance
  popover, the photo cropper, the settings modal, the search overlay).
- Debugging a mobile-only layout bug a desktop check missed (a popover
  overflowing the viewport, a modal footer pushed up by the keyboard,
  the sidebar drawer vs the docked rail).
- Verifying a CSS rule actually wins the cascade.

Do **not** invoke when:

- The change has no visible surface (a pure domain/store refactor in
  `src/app/*.ts`, the sync engine, export renderers, migrations). Type-
  check and `vitest` are the right loop there.
- The bug is behavioural with no visual component. Read the in-app Logs
  (Settings → Logs) or add a test instead.
- The visual concern is the PWA / launcher / browser-tab icon (that's
  `scripts/generate-icons.mjs` + `make icons`, a different pipeline).

## Pipeline

```
your code edit
   │
   ▼  vite HMR (already running via `npm run dev`)
   │
   ▼  node .agent/skills/design/screenshot.mjs
   │       ├─ resolves chromium (playwright / @playwright/test / playwright-core)
   │       ├─ resolves base URL (dev 5173 → preview 4173 fallback)
   │       ├─ for each --viewports entry:
   │       │     ├─ open Chromium context with that viewport
   │       │     ├─ run `recipe(page, viewport)` (the editable block)
   │       │     └─ page.screenshot() → /tmp/design-<viewport>.png
   │       └─ prints the written paths to stdout
   │
   ▼  Read /tmp/design-desktop.png  /tmp/design-mobile.png
   │
   └── inspect, decide, loop
```

`recipe(page, viewport)` is the only block you edit between iterations.
It's near the bottom of the script under a clear `// === RECIPE ===`
banner. Everything above is reusable plumbing.

## Mobile is mandatory, not optional

This app is a phone-first PWA, so **every visual change must be verified at a
phone viewport — never desktop alone.** Desktop and mobile are different
layouts (the `sm` breakpoint at 640px flips the docked sidebar to a drawer,
restacks field rows, and reflows popovers/modals), so a change that reads
perfectly on desktop routinely breaks on a 390px screen — a control row that
overflows, a select that clips, a dialog footer under the soft keyboard.

Concretely:

- **Always shoot `mobile` alongside `desktop`.** Never run the harness with
  `--viewports desktop` by itself. The default (`desktop,mobile`) already does
  both — don't narrow it. When a change touches a landscape-sensitive surface
  (a full-height modal, the cropper), add `mobile-landscape` too.
- **Read the mobile PNG every iteration**, not just at the end. A loop that
  only looks at desktop and checks mobile once at the finish has usually
  already baked in a phone regression.
- A change is **not done** until the phone render is confirmed correct — see
  Verification below. "Looks right on desktop" is half a result.

## The iteration loop

1. **Boot the dev server once.** Vite HMR makes reloads ~100ms after the
   first warm-up. `npm run dev` seeds a large fake address book
   (`VITE_SEED`), so the app comes up populated — including a contact
   with a photo — with no setup.

   ```sh
   npm run dev &
   ```

   If `npm run dev` is already running, skip this step. Use
   `npm run dev:clean` for an unseeded (empty) address book.

2. **Edit the recipe** at the bottom of
   `.agent/skills/design/screenshot.mjs`. The default recipe opens the
   appearance popover on the seeded contact — replace it with the flow
   that lands on the state you want to see. Use the exported helpers
   (`openApp`, `enterEditMode`, `openAppearancePopover`,
   `openPhotoCropper`, `openSettings`) instead of re-clicking the chrome.

3. **Edit the code you're designing** under `src/app/`. One targeted
   change per iteration — a diff that touches three CSS rules at once
   makes it hard to tell which one moved the screenshot.

4. **Run the harness.**

   ```sh
   node .agent/skills/design/screenshot.mjs --viewports desktop,mobile
   ```

   Vite HMR has already shipped the edit to the running tab; the fresh
   Chromium context just opens to the current state. No rebuild step.

5. **Read the PNGs.**

   ```
   Read /tmp/design-desktop.png
   Read /tmp/design-mobile.png
   ```

6. **Adjust and repeat.** Two to four iterations from a clean starting
   point is usually enough. If you're past six iterations on the same
   surface, the source probably wants restructuring (split the
   component, change the layout primitive, swap the responsive strategy)
   instead of another nudge to the same rule.

## CLI flags

All flags are optional.

| Flag                 | Default          | What it does                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--base-url <url>`   | auto-detect      | Where the app is served. Defaults to `http://localhost:5173/` (vite dev), falling back to `http://localhost:4173/` (vite preview). Pass an explicit URL to target a deployed slot (e.g. `/preview`).                                                                                      |
| `--out <dir>`        | `/tmp`           | Output directory for the PNGs.                                                                                                                                                                                                                                                            |
| `--name <prefix>`    | `design`         | Filename prefix. Useful when iterating on two screens in parallel (`--name popover` vs `--name cropper`).                                                                                                                                                                                 |
| `--viewports <list>` | `desktop,mobile` | Comma-separated subset of `desktop`, `mobile`, `mobile-landscape`, `tablet`. The app's `sm` breakpoint is 640px: `mobile` (390) renders the drawer layout, `tablet` (768) the docked one. Mobile viewports write `fullPage: false` (one-screen capture); desktop writes the full content. |

## Available helpers

All exported from `screenshot.mjs`; the recipe runs in the same file, so
they're already in scope.

| Helper                         | What it does                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openApp(page)`                | Navigate to the app root and wait until the shell has rendered (the card's Edit/Done control, or the phone's "Open sidebar" button). Universal first step.                                                                                                                                                  |
| `enterEditMode(page)`          | Put the open contact card into edit mode (no-op if already there) — where the appearance popover and the field form live.                                                                                                                                                                                   |
| `openSidebar(page)`            | Ensure the side menu is reachable: a no-op on wide screens (docked), opens the drawer on phones via the "Open sidebar" button.                                                                                                                                                                              |
| `newContact(page)`             | Create a fresh contact and land on its card (opens straight in edit mode). Opens the sidebar first on phones.                                                                                                                                                                                               |
| `openAppearancePopover(page)`  | Enter edit mode, then tap the avatar to open the Photo / Colour / Icon popover. Verified against `ContactAppearancePopover.tsx`.                                                                                                                                                                            |
| `openPhotoCropper(page, img)`  | Open the appearance popover and upload an image to open the circle cropper. `img` defaults to a bundled PWA icon, so a recipe needs no fixture of its own.                                                                                                                                                  |
| `openList(page)`               | Open the List overview page from the side-menu action grid (waits on the "List" heading).                                                                                                                                                                                                                   |
| `openFavorites(page)`          | Open the Favorites page from the action grid (waits on the "Favorites" heading — the button and page share the name, so match the heading role).                                                                                                                                                            |
| `openSettings(page)`           | Open the Settings dialog from the side menu's footer.                                                                                                                                                                                                                                                       |
| `openSettingsTab(page, name)`  | Open Settings and switch to a named tab ("Format", "Storage", "Developer", …). The tabs are a FloatingPanel menu behind the title button, not a tab strip.                                                                                                                                                  |
| `scrollSettingsToBottom(page)` | Scroll the Settings dialog's tab body to the bottom to shoot sections below the fold (scoped to the dialog, so it won't scroll the sidebar list).                                                                                                                                                           |
| `swipeRow(page, locator, dx)`  | Swipe a row horizontally with a real CDP touch drag and leave the reveal latched for the screenshot. Negative `dx` = left (trailing actions), positive = right. Needs a `hasTouch` viewport — hand-dispatched PointerEvents can't drive `useRowSwipe` (its `setPointerCapture` throws on synthetic events). |

When a helper you need is missing, add it to the HELPERS block of
`screenshot.mjs` so the next agent gets it for free (and update the
table above + the **Skill self-improvement** section). Match against a
control's accessible name (`getByRole("button", { name: … })`); the
app's controls carry aria-labels from the i18n catalog.

## Recipe patterns

### "I just want to see the seeded contact card"

```js
async function recipe(page) {
  await openApp(page);
}
```

### "I'm designing the appearance popover"

```js
async function recipe(page) {
  await openApp(page);
  await openAppearancePopover(page);
}
```

### "I'm designing the circle photo cropper on mobile"

```js
async function recipe(page, viewport) {
  await openApp(page);
  if (viewport.startsWith("mobile")) await openPhotoCropper(page);
}
```

### "I'm tuning the settings dialog"

```js
async function recipe(page) {
  await openApp(page);
  await openSettings(page);
}
```

### "I'm designing a specific settings tab (e.g. Format)"

```js
async function recipe(page) {
  await openApp(page);
  await openSettingsTab(page, "Format");
  // Sections below the fold? Reveal them:
  await scrollSettingsToBottom(page);
}
```

A tab whose controls start in an "off" state (a master toggle gating nested
options) is easiest to shoot by pre-seeding the persisted settings before the
app boots, rather than clicking toggles a modal backdrop may intercept:

```js
await page.addInitScript(() => {
  localStorage.setItem(
    "contacts:settings",
    JSON.stringify({ phoneFormat: true }),
  );
});
```

### "I want both light and dark mode side-by-side"

Run the harness twice with `--name design-light` / `--name design-dark`
and set the theme in `localStorage` before the first navigation (or
toggle it in Settings inside the recipe). Keeping the two runs separate
makes the diff between them obvious in the Read output.

## Common pitfalls

In roughly descending order of recurrence:

1. **Forgot to start the dev server.** The harness errors out with a
   pointer to `npm run dev` / `npm run preview`. Boot it once at the
   start of the session and leave it running.
2. **Playwright isn't installed.** The script needs one of
   `playwright` / `@playwright/test` / `playwright-core` — see the
   prerequisite note above. The resolution error names the fix.
3. **Recipe forgets to `await` an interaction.** A bare promise means
   the next step races; the PNG sometimes captures the right state and
   sometimes doesn't. Always `await` every helper call.
4. **A popover's dismiss backdrop eats the next click.** The framework
   `FloatingPanel` (appearance popover) renders a backdrop above a
   `Modal` — a recipe that opens the popover _and then_ the cropper must
   let the popover close first (the app already does this on upload).
5. **Viewport mismatch with media queries.** The app's `sm` breakpoint
   is 640px. `mobile` (390) is the drawer layout; `tablet` (768) docks
   the sidebar. Shoot the viewport whose band your CSS actually targets.
6. **Strict-mode locator violations.** Every accessible-name match must
   be unique or `.first()`-qualified. Seeded data adds many contact rows
   and folder-scoped "New contact in …" buttons — prefer exact-match
   regexes (`/^New contact$/`) over substrings.

## Verification

A loop is "done" when:

- **The `mobile` PNG matches the intended design — this is a hard gate, not a
  nice-to-have.** A change verified on desktop only is unfinished, full stop.
- The PNG at every required viewport (always including `mobile`) matches the
  intended design.
- The same code path looks right at the _next_ breakpoint up (the
  desktop edit didn't regress mobile, or vice versa).
- The change passes `make lint` and `make test`; the visual signal in
  the screenshots is not a substitute for the lint/test gates.
- If it's a user-visible UI change, a `.changes/unreleased/` fragment
  records it (see `scripts/release/fragments.mjs` for the format).

## Skill self-improvement

The script has two halves with opposite lifetimes: the **recipe** is
per-iteration scratch (revert it when you're done — it's noise in the
diff), but the **HELPERS block is durable and shared**. Any flow you had
to work out — reaching a screen, dismissing an overlay, seeding a state,
scrolling a scoped container — is something the next session in a
_different_ area will hit too. So when a recipe needs a step that isn't a
one-off, promote it:

- **Extract it into a named helper in the HELPERS block** (e.g.
  `openSettingsTab`, `openSearchOverlay`), give it a doc comment that
  records any gotcha you discovered (a selector that matched the wrong
  element, a backdrop that ate the click), and add a row to the
  **Available helpers** table.
- **Leave that helper in the script when you revert the recipe.** Reverting
  the scratch recipe should _not_ take the helper with it — the helper is
  the reusable payoff, and it stays committed so the next session gets it
  for free.
- **Verify the helper before you leave it** — run the harness once through
  the new helper so a future session isn't the one to discover it's stale.

After a run, also:

1. If the recipe needed a helper that wasn't in the script, follow the
   promote-and-keep rule above. Common candidates: opening the search
   overlay, the archive screen, the namespaces manager, a specific
   settings tab, or seeding a specific contact state.
2. If a real selector drifts (an aria-label changes in the i18n
   catalog), fix the helper and note it here.
3. If a new viewport mattered for the bug (a foldable, an ultrawide, a
   narrow band where a media query flips), add it to `VIEWPORTS` and
   mention the breakpoint context.
4. If `--base-url` had to point at a deployed slot (`/preview`, prod)
   and the fallback chain didn't anticipate it, extend `resolveBaseUrl`
   and update the CLI flags table.
5. Commit the skill edit alongside the design edit so the next loop
   starts from current truth, and refresh `.last-updated` with the
   commit hash the skill was last verified against.
