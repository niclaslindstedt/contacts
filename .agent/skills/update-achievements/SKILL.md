---
name: update-achievements
description: "Use when the achievements catalog (src/app/achievements.ts) is stale relative to a newly-shipped user-facing feature — or when a fresh trophy needs adding, a trigger predicate rewriting, or the achievements modal chrome touching. Every feature in this app is also an unlockable trophy across four tiers (Beginner → Intermediate → Pro → Expert); this skill covers how to add one, slot it into the right tier, phrase it in English AND Swedish, and wire its trigger so the unlock fires when the user does the thing."
---

# Updating the achievements catalog

**Governing spec sections:** §21.5 (a drift-prone artifact with a mandated sync
skill), §11.1 (docs sync for any feature doc touched).

Every user-visible feature in contacts should also be a **trophy**. When a
feature ships and the catalog isn't updated, the achievements tour silently
lies about what the app can do. This skill brings the catalog — and its i18n
shadow — back into sync with the feature surface.

The system lives in **four places that must stay in lockstep**:

- **The catalog spec** at `src/app/achievements.ts` — `SPECS`, an array of
  structural entries (`id`, `tier`, `glyph`, optional `hasLearnMore`, and the
  unlock `trigger`). **No display strings here.** Predicate helpers for the
  derived triggers live at the top of the same file; `buildCatalog(t)` at the
  bottom composes each spec with its translated copy into the framework
  `Achievement`.
- **The i18n copy** under `achievements.catalog.<id>.{name,condition,learnMore?}`
  in **both** `src/app/i18n/en.ts` and `src/app/i18n/sv.ts`. English is the
  `Catalog` type source; Swedish must mirror it key-for-key (`sv: Catalog`), so
  a missing key is a compile error and an empty one fails
  `tests/achievements_i18n_test.ts`. The modal chrome lives beside it under
  `achievements.modal.*`, `achievements.unlock.*`, and `achievements.trophy.*`.
- **The wiring** in `src/App.tsx` — `buildCatalog(t)` is memoised on `t` and
  passed to `useAchievementWatcher` (derived triggers) and to the framework
  `AchievementsModal` / `AchievementUnlockModal` / `TrophyButton` (with the
  translated `labels`). New catalog entries appear automatically; only a new
  **manual** trigger needs a call site.
- **The tests** `tests/achievements_test.ts` (derived triggers + structure) and
  `tests/achievements_i18n_test.ts` (en/sv parity, no orphan copy).

## Tracking mechanism

`.agent/skills/update-achievements/.last-updated` holds the git commit hash from
the last successful run (matching the repo's other `update-*` skills). Empty
means "never run" — fall back to the initial commit.

```sh
BASELINE=$(cat .agent/skills/update-achievements/.last-updated)
[ -z "$BASELINE" ] && BASELINE=$(git rev-list --max-parents=0 HEAD | tail -1)
```

## Discovery process

The catalog tracks **user-visible** features, and the repo already classifies
those: every user-visible PR drops a `.changes/unreleased/<ts>-<slug>.md`
fragment, and the Release workflow collates fragments into `CHANGELOG.md` and
deletes them. That trail — fragments plus the released CHANGELOG — is the
feature ledger; it filters out refactors and build tweaks before you see them.

1. **Walk the CHANGELOG and any unreleased fragments** since the baseline:

   ```sh
   git log --oneline "$BASELINE"..HEAD -- CHANGELOG.md .changes/
   ls .changes/unreleased/*.md 2>/dev/null
   ```

   Read the added bullets and fragment bodies — each is one user-visible change.

2. **Cross-check source** for features that shipped without a fragment:

   ```sh
   git diff --name-only "$BASELINE"..HEAD -- src/app/
   ```

3. **Classify each candidate:**
   - **Add a trophy** when a brand-new user-facing surface lands (a new field, a
     gesture, a modal, a setting, a storage/sync/backup capability).
   - **Edit a trophy** when a shipped one's condition or learn-more is now wrong
     (a renamed setting, a moved menu path) — fix the i18n copy, not the id.
   - **Retarget/remove** when a feature moved or went away. Stable ids are
     write-once: never repurpose an id. To remove, delete the `SPECS` entry AND
     the `achievements.catalog.<id>` block from **both** locales.
   - **Skip** bug fixes, layout polish, refactors, and dev-only surfaces.

### Where each feature lives (source map)

| Source                                                                      | Answers                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/app/types.ts`                                                          | What concepts/fields a `Contact` / `Folder` carries.   |
| `src/app/i18n/en.ts`                                                        | What the feature is called and its exact menu paths.   |
| `src/app/ContactEditView.tsx` / `ContactReadView.tsx`                       | Card fields the user fills or reads.                   |
| `src/app/SideMenuContent.tsx`, `ContactListScreen.tsx`, `ArchiveScreen.tsx` | Folder/list/archive gestures.                          |
| `src/app/settings/tabs.tsx`                                                 | User-configurable behaviour, export/import, backups.   |
| `src/app/useSyncEngine.ts`                                                  | Sync backends, connection, encryption, backup targets. |
| `src/app/useNamespaces.ts`                                                  | Namespaces (separate address books).                   |
| `src/app/useContactStore.ts`                                                | The edit actions that mutate the document (undo/redo). |

## The tier rubric

Tier is decided by _what the user already had to understand_ to reach it — not
by internal complexity.

| Tier             | The user is …                                     | Slot a trophy here when it …                                                                                                                                            |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Beginner**     | New. Just opened the app.                         | Is required to use the app at all — name a card, add a phone and an email. Zero setup beyond a click.                                                                   |
| **Intermediate** | Has a working address book. Wants it to fit life. | Adds structure to a card or the book: birthdays, addresses, important dates, favorites, emergencies, company cards, folders, subfolders, archiving, a second namespace. |
| **Pro**          | Has a structured book. Wants it kept and carried. | Reaches past a single card: photo galleries, attachments, cloud/folder sync, backups.                                                                                   |
| **Expert**       | Trusts the data. Wants edge cases and safety.     | Not required for a healthy book: export, import, undo, auto-archive, encryption.                                                                                        |

Tie-breakers: an action lives in the tier where it is first _needed_, not first
_possible_; when torn between two tiers, pick the lower; skip anything without a
clean unlock trigger (passive observations, "opened a menu").

## Naming and phrasing

Each entry carries three strings, in `en.ts` **and** `sv.ts`:

- **`name`** — playful, game-style, 1–3 words (_First Contact_, _Cold Storage_,
  _Cloud Walker_, _Sealed_). Capitalised as a proper noun.
- **`condition`** — a second-person imperative ending in a period that answers
  "how do I unlock this?" ("Star a contact as a favorite.").
- **`learnMore`** _(only where the spec sets `hasLearnMore: true`)_ — one short
  paragraph expanding the feature. Reserve it for the bigger trophies; most
  entries omit it.

Voice: second person, present tense, active verbs; no code identifiers in
user-visible text; no tier-leaks; keep it translatable (write the Swedish at the
same time).

## Adding a trophy — four steps

1. **Author the spec** in `src/app/achievements.ts`: pick a stable camelCase
   `id`, import its glyph (`@niclaslindstedt/oss-framework/components` for
   neutral marks, `./icons.tsx` for the domain ones — `IceIcon`, `GiftIcon`,
   `MapPinIcon`, `PaperclipIcon`, `BuildingIcon`, `FavoriteIcon`…), set the
   `tier`, and set `hasLearnMore: true` only if you'll write a body.
2. **Write the copy** — add `achievements.catalog.<id>.{name,condition}` (plus
   `learnMore` when declared) to `en.ts`, then mirror it in `sv.ts`.
3. **Wire the trigger:**
   - **`derived`** — the unlock fires when a predicate over the document flips
     `false → true`. Add (or reuse) a helper at the top of `achievements.ts`
     (`hasFavorite`, `hasSubfolder`, …) and use `derived(pred, slice)`. The
     watcher in `App.tsx` picks it up automatically — no other edit.
   - **`manual`** — the gesture is outside the document (search, undo, export,
     import, connecting sync, encryption, taking a backup, creating a
     namespace). Set `trigger: manual` and add a `unlock("<id>")` call at the
     chokepoint. Existing sites: `SearchOverlay.tsx` (search), `App.tsx`
     (undo + the sync/encryption effects), `ContactScreen.tsx` / `SelectToast.tsx`
     (export), `settings/tabs.tsx` (import + backup), `BackupsModal.tsx`
     (backup snapshot), `useNamespaces.ts` (namespace create).
4. **Test** — add a case to `tests/achievements_test.ts`. Derived triggers use
   `deriveUnlocks(catalog, prev, next, {})`; manual triggers are asserted to
   appear in `SPECS` and never derive from a document change. Run `make test`.

### Pitfall: a manual trophy with no call site never fires

A `manual` entry with no matching `unlock("<id>")` silently never unlocks. When
you add one, verify the call site exists **in the same change**:

```sh
grep -rn 'unlock("<id>")' src/ --include="*.ts" --include="*.tsx"
```

To audit the whole catalog for orphans, intersect the wired ids with the manual
`SPECS` ids:

```sh
grep -rhoE 'unlock\("[a-zA-Z0-9_]+"\)' src/ --include="*.ts" --include="*.tsx" | sort -u
```

## Update checklist

- [ ] Read `BASELINE`; walk the CHANGELOG, fragments, and `src/app/` diff.
- [ ] For each user-visible candidate: add / edit / retarget / skip.
- [ ] Keep `SPECS` and the two i18n catalogs in lockstep (id ⇒ name + condition
      in both locales; `learnMore` iff `hasLearnMore`).
- [ ] Every manual id has a wired `unlock("<id>")` call.
- [ ] If a trophy links a feature doc, create/update `docs/features/<slug>.md`
      and ship a `.changes/unreleased/` fragment (a user-visible change).
- [ ] `make fmt`, `make lint`, `make test`, `make build` all pass.
- [ ] Write the new baseline:

      git rev-parse HEAD > .agent/skills/update-achievements/.last-updated

## Verification

1. Every candidate is reflected in the catalog or intentionally skipped.
2. Every `trigger` is wired: derived predicates have a state inspector; manual
   ids have an `unlock("<id>")` call reachable from the user's gesture.
3. `tests/achievements_test.ts` and `tests/achievements_i18n_test.ts` pass, as
   do `make lint` and `make build`.
4. `.last-updated` holds the new `HEAD`.

## Skill self-improvement

After a run, improve this file in place:

1. **Grow the source map** when a new component/hook lands that a feature hides
   behind.
2. **Grow the predicate helpers list** when a new "first time" inspector is
   added to `achievements.ts`.
3. **Record naming rulings** that took thought, so the next run inherits them.
4. **Commit the skill edit** alongside the catalog edits.
