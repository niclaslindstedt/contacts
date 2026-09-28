// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The markdown What's new renders — the CHANGELOG and the feature docs — as
// the phone and desktop apps load it: without a link back to the source or a
// mention of the website's domain (the owner's decision;
// `./sourceLinks.ts`). `vite.config.ts` applies it at build time, as each
// `.md?raw` module is loaded, so the text never reaches those bundles.
//
// BUILD-TIME ONLY: the app must never import this module. It spells the very
// name it looks for, and `scripts/website-only.mjs` refuses an app bundle that
// carries it.

// Whatever carries the owner's name: a GitHub URL, the website's domain.
const SOURCE_MARK = "niclaslindstedt";

// A markdown link whose target carries it.
const SOURCE_LINK = /\[([^\]]*)\]\(([^)\s]*niclaslindstedt[^)\s]*)\)/g;

/**
 * Markdown (the CHANGELOG, a feature doc) as a build without source links
 * shows it: a link to the source keeps its words and loses its target, and a
 * list item or line that still names the owner's domain — "a new home at
 * contacts.niclaslindstedt.se" — is dropped whole, continuation lines with it.
 * Pure, so it is testable on any text.
 */
export function withoutSourceLinks(markdown: string): string {
  const unlinked = markdown.replace(SOURCE_LINK, "$1");
  const out: string[] = [];
  const lines = unlinked.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const item = /^(\s*)[-*+]\s/.exec(line);
    if (item) {
      // A list item — nested items included — runs until the next line that
      // is blank or indented no deeper than its marker.
      let end = i + 1;
      while (
        end < lines.length &&
        lines[end]!.trim() !== "" &&
        /^\s*/.exec(lines[end]!)![0].length > item[1]!.length
      ) {
        end++;
      }
      const block = lines.slice(i, end);
      if (!block.some((l) => l.includes(SOURCE_MARK))) out.push(...block);
      i = end - 1;
      continue;
    }
    if (!line.includes(SOURCE_MARK)) out.push(line);
  }
  return out.join("\n");
}
