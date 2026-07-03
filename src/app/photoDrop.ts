// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure drag-and-drop predicates for dropping a photo onto a contact. Kept apart
// from the `ContactPhotoDropZone` component (the same way `importFiles.ts` is
// kept apart from `ImportDropZone.tsx`) so the routing rules stay node-testable.
//
// The contact photo drop lives *inside* the address-book import drop zone
// (`ImportDropZone`), so the two must not both claim the same drag. The split is
// by kind: an **image** file means "set this contact's photo", anything else
// (a `.vcf`/CSV/JSON) means "import contacts". These helpers decide which side a
// drag belongs to; the component stops image drags from reaching the importer.

/** The shape of a `DataTransferItem` these helpers read — just its kind/type,
 *  so plain objects stand in for the DOM type in tests. */
export type DragItemLike = { kind: string; type: string };

/** Whether a drag carries an image file — the signal that the contact photo
 *  drop zone (rather than the contact importer) should claim it. Reads the
 *  drag's `items` MIME types, which browsers expose during the drag; a file of
 *  unknown type is deliberately *not* treated as an image, so a `.vcf` with a
 *  blank type still falls through to the importer. */
export function dragCarriesImage(items: readonly DragItemLike[]): boolean {
  return items.some((it) => it.kind === "file" && it.type.startsWith("image/"));
}

/** The first image among dropped files, or null when none is an image. On drop
 *  the real file types are known, so this is the authoritative check that a
 *  drop is a photo (and which file to use) rather than something to import. */
export function firstImageFile<T extends { type: string }>(
  files: readonly T[],
): T | null {
  for (const file of files) {
    if (file.type.startsWith("image/")) return file;
  }
  return null;
}
