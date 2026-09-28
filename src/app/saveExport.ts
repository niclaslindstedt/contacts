// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Every file the app hands the reader — the vCard / CSV / JSON exports, a
// backup `.zip`, a calendar reminder `.ics`, an attachment — leaves through
// here, and so through the framework's `saveFile`: a download in a browser,
// the share sheet in a shell that offers the `save-file` capability (the
// phone app does, see `native/src/saveFileBridge.ts`). A `blob:` download in
// the phone app's WebView goes nowhere, which is why nothing in `src/` may
// call `downloadText` / `downloadBlob` / `saveDataUrl` directly.
//
// The page never asks where it runs: `saveFile` reads the capability.

import {
  dataUrlToBlob,
  saveFile,
  type SaveFileInput,
  type SaveFileOutcome,
} from "@niclaslindstedt/oss-framework/files";

import { log } from "./log.ts";

/** Save `input` for the reader. Resolves with how it left, or `null` when the
 *  share sheet reported a failure — logged, never thrown, so a click handler
 *  can fire it and forget. */
export async function saveExport(
  input: SaveFileInput,
): Promise<SaveFileOutcome | null> {
  try {
    return await saveFile(input);
  } catch (err) {
    log.warn(
      `export: ${input.filename} could not be saved — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}

/** Save a payload stored as a base64 `data:` URL (an attachment's bytes).
 *  Returns false at once when the bytes cannot be prepared — not yet pulled
 *  from a cloud file, say — so the caller can say so. */
export function saveDataUrlExport(
  filename: string,
  dataUrl: string | null | undefined,
  mime?: string,
): boolean {
  const blob = dataUrlToBlob(dataUrl, mime);
  if (!blob) return false;
  void saveExport({ blob, filename });
  return true;
}
