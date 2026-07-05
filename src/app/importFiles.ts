// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The browser glue that feeds real files into the pure import readers. Kept
// apart from `import.ts` (the same way the framework's download glue is kept
// apart from `export.ts`) so the readers stay pure and node-testable: this
// module reads a dropped or picked `File`'s text and hands it to
// `parseImportFile`.

import { parseImportFile, type ImportedContact } from "./import.ts";

/** The accept filter for the Import file picker and a hint for a drop. */
export const IMPORT_ACCEPT =
  ".vcf,.vcard,.csv,.json,text/vcard,text/csv,application/json";

/** The outcome of reading a batch of files: the cards parsed out of them and
 *  how many files actually yielded something, so the caller can tell "imported
 *  N contacts" from "that file had none". */
export type ImportResult = {
  contacts: ImportedContact[];
  /** Files that parsed to at least one card. */
  usedFiles: number;
  /** Files that were read but yielded no importable card. */
  emptyFiles: number;
};

/** Read every file's text and parse it with the format its name/content calls
 *  for, concatenating the cards. A file that reads but parses to nothing counts
 *  as empty rather than failing the whole drop. */
export async function readImportedContacts(
  files: readonly File[],
): Promise<ImportResult> {
  const contacts: ImportedContact[] = [];
  let usedFiles = 0;
  let emptyFiles = 0;
  for (const file of files) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      emptyFiles += 1;
      continue;
    }
    const parsed = parseImportFile(file.name, text);
    if (parsed.length > 0) {
      contacts.push(...parsed);
      usedFiles += 1;
    } else {
      emptyFiles += 1;
    }
  }
  return { contacts, usedFiles, emptyFiles };
}

/** Pull the `File`s off a drop's `DataTransfer`. Prefers the typed `files`
 *  list; falls back to walking `items` (some browsers only populate one). */
export function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  if (dt.files && dt.files.length > 0) return Array.from(dt.files);
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

/** Whether a drag carries files (rather than text or an element) — the signal
 *  that decides if the import overlay should show. */
export function dragHasFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.types ?? []).includes("Files");
}
