// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A changelog bullet's `[Learn more](feature:<slug>)` link, kept only when
// this build carries the feature doc it opens.
//
// History stays as it was written, but a build can leave a doc out — the
// achievements page in the phone and desktop apps (`./changelog.ts`) — and a
// link to it would be a "Learn more" that opens nothing. So the link, with the
// space before it, is dropped and the bullet kept. Pure, so it is testable
// against any doc set.

const FEATURE_LINK = /\s*\[[^\]]*\]\(feature:([^)\s]+)\)/g;

export function withoutMissingFeatureLinks(
  markdown: string,
  docs: Readonly<Record<string, unknown>>,
): string {
  return markdown.replace(FEATURE_LINK, (link, slug: string) =>
    Object.hasOwn(docs, slug) ? link : "",
  );
}
