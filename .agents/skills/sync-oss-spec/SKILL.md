---
name: sync-oss-spec
description: "Use when the repository may have drifted out of conformance with OSS_SPEC.md — after a spec bump, after adding files at the repo root, or when validate.sh reports violations. Runs the validator, walks the violations, and fixes each one."
---

# Sync with OSS_SPEC

This repo claims conformance to `OSS_SPEC.md` (OSS_SPEC §21.5 asks every such repo to ship this skill). The spec's own CLI is `oss-spec validate .`; where the Rust binary is not installed, the standalone bash mirror does the deterministic half and prints the qualitative checklist an agent then works through.

## When to run

- After bumping the `OSS_SPEC.md` copy at the repo root to a newer version.
- After adding, renaming or removing anything at the repo root, under `.github/`, or under `.agents/skills/`.
- As the last step of a `maintenance` sweep, to catch what the per-artifact skills did not touch.

## Tracking mechanism

`.agents/skills/sync-oss-spec/.last-updated` holds the commit this skill last ran against:

```sh
BASELINE=$(cat .agents/skills/sync-oss-spec/.last-updated 2>/dev/null)
git diff --name-only "${BASELINE:-$(git rev-list --max-parents=0 HEAD)}"..HEAD -- OSS_SPEC.md .github .agents Makefile README.md AGENTS.md
```

## Discovery process

1. Run the validator:

   ```sh
   oss-spec validate . 2>/dev/null || curl -fsSL https://raw.githubusercontent.com/niclaslindstedt/oss-spec/main/scripts/validate.sh | bash -s -- .
   ```

2. Read the **whole** output: the "Structural violations" list names a spec section and an exact path per line; the "Agent review checklist" is the qualitative half the script cannot check, and it is part of the run.
3. The website is unlisted: the `oss-spec:unlisted-website:` marker in `AGENTS.md` exempts it from §11.3.1–§11.3.11 and §11.4.7 (§11.3.12), so no `seo`/`lighthouse` workflow, sitemap, JSON-LD, `llms.txt` or page-weight budget is owed. What the validator checks instead is the `noindex` meta on every page and a `robots.txt` that allows crawling — keep both, and never add a sitemap, `llms.txt`, JSON-LD or a canonical link.
4. Compare the spec version in `OSS_SPEC.md`'s front matter with the one the script says it is pinned against; a newer spec may carry mandates the script does not check yet — read its changelog section.

## Mapping

| Violation names…                      | Fix in…                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| A missing root file (§2–§9)           | Add it, modelled on the sibling `meds` repo's copy                                 |
| A `.md` that must be a symlink (§7.1) | `ln -sfn AGENTS.md <name>`; `.github/copilot-instructions.md` links `../AGENTS.md` |
| A missing workflow (§10)              | `.github/workflows/` — copy the sibling's and rename the app's identity            |
| PWA scaffolding (§11.4)               | `index.html`, `public/`, `pwa-plugin.ts`                                           |
| `.agents/skills` (§21)                | The skill's `SKILL.md` sections, its `.last-updated`, the `maintenance` registry   |
| Test naming or file size (§20)        | Rename to `*_test.ts`; split the file by concern                                   |
| A README section (§3)                 | `README.md` — run `update-readme` if the surface itself moved                      |

## Update checklist

- [ ] Fix every structural violation
- [ ] Work through every § block of the agent review checklist and fix what it names
- [ ] Re-run the validator until it reports no structural violations
- [ ] `make fmt`, `make lint`, `make test`
- [ ] Record the marker:

      git rev-parse HEAD > .agents/skills/sync-oss-spec/.last-updated

## Verification

1. The validator reports "Structural violations: none".
2. `make lint` and `make test` pass.
3. Every symlink in §7.1 and §21.2 resolves (`ls -la CLAUDE.md .claude/skills`).

## Skill self-improvement

If a violation needed a fix this mapping table does not cover, add the row. If the spec bump introduced a mandate the validator does not check, note it under Discovery so the next run reads for it.
