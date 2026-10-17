// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The markdown What's new renders — the CHANGELOG and the feature docs — as
// the phone app loads it: without a word about Dropbox, which that build does
// not carry (`./dropboxBuilt.ts`). `vite.config.ts` applies it at build time,
// as each `.md?raw` module is loaded, so the text never reaches that bundle.
// The website and the desktop app load the markdown whole.
//
// BUILD-TIME ONLY: the app never imports this module.

const DROPBOX = /dropbox/i;

/** A markdown heading's level (`## …` is 2), or 0 for any other line. */
function headingLevel(line: string): number {
  const m = /^(#{1,6})\s/.exec(line);
  return m ? m[1]!.length : 0;
}

/**
 * Markdown as a build without Dropbox shows it. Three cuts, in order:
 *
 * - a section whose heading names Dropbox goes whole, down to the next
 *   heading of the same or a higher level;
 * - a list item (with its continuation lines and nested items) or a paragraph
 *   that names Dropbox goes whole;
 * - a heading the first two cuts left with nothing under it goes too, so a
 *   release keeps no empty "Fixed" (one that was empty already stays).
 *
 * So a doc keeps Dropbox in its own paragraphs, list items or sections, and
 * says everything else in words that are true without it. Pure, so it is
 * testable on any text.
 */
export function withoutDropbox(markdown: string): string {
  const lines = markdown.split("\n");
  // Indices into `lines`, so a heading can be judged before and after.
  const kept: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const level = headingLevel(line);
    if (level > 0) {
      if (DROPBOX.test(line)) {
        let end = i + 1;
        while (end < lines.length) {
          const l = headingLevel(lines[end]!);
          if (l > 0 && l <= level) break;
          end++;
        }
        i = end - 1;
      } else {
        kept.push(i);
      }
      continue;
    }
    if (line.trim() === "") {
      kept.push(i);
      continue;
    }
    // A list item runs until the next line that is blank, a heading, or
    // indented no deeper than its marker; a paragraph until a blank line, a
    // heading or a list item.
    const item = /^(\s*)[-*+]\s/.exec(line);
    let end = i + 1;
    while (end < lines.length) {
      const next = lines[end]!;
      if (next.trim() === "" || headingLevel(next) > 0) break;
      if (item) {
        if (/^\s*/.exec(next)![0].length <= item[1]!.length) break;
      } else if (/^\s*[-*+]\s/.test(next)) {
        break;
      }
      end++;
    }
    const block = lines.slice(i, end);
    if (!block.some((l) => DROPBOX.test(l))) {
      for (let k = i; k < end; k++) kept.push(k);
    }
    i = end - 1;
  }
  const all = lines.map((_, k) => k);
  return kept
    .filter(
      (k, at) =>
        headingLevel(lines[k]!) === 0 ||
        hasText(lines, kept, at) ||
        !hasText(lines, all, k),
    )
    .map((k) => lines[k]!)
    .join("\n");
}

/** Whether the heading at `order[at]` has text under it before the next
 *  heading of the same or a higher level — a deeper heading with text of its
 *  own counts. */
function hasText(lines: string[], order: number[], at: number): boolean {
  const level = headingLevel(lines[order[at]!]!);
  for (let j = at + 1; j < order.length; j++) {
    const line = lines[order[j]!]!;
    const l = headingLevel(line);
    if (l > 0 && l <= level) return false;
    if (l === 0 && line.trim() !== "") return true;
  }
  return false;
}
