// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Browser download glue for the export surface: wrap a rendered export in a
// Blob and click a transient anchor at it. Kept apart from `export.ts` so the
// renderers stay pure and node-testable.

export function downloadText(
  filename: string,
  text: string,
  mime: string,
): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

/** Click a transient anchor at a Blob to save it under `filename`. The binary
 *  counterpart to {@link downloadText} — used to download an attachment's
 *  bytes. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const MIME_VCARD = "text/vcard;charset=utf-8";
export const MIME_CSV = "text/csv;charset=utf-8";
export const MIME_JSON = "application/json;charset=utf-8";
export const MIME_ICS = "text/calendar;charset=utf-8";
