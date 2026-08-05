// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Fetching a photo's full-resolution original on demand.
//
// The archival tier — the kept original behind each crop — is the biggest half
// of what a cloud copy holds (a ≤1024 px source runs ~150 KB against a crop's
// ~50 KB) and the least often wanted: nothing renders it until someone taps a
// photo to view it full-screen or re-opens the cropper. Downloading every one
// on open, as the app used to, spent most of a cold start's requests on a case
// that usually never happens — and those requests are what a drive throttles.
//
// So the sync engine no longer reads sources eagerly (see `photoStore.ts`), and
// this module is how the screens ask for one when they actually need it. It is
// a small registry rather than a React context because the byte transport lives
// in the sync engine and the callers are scattered leaves (the lightbox, the
// cropper) — threading a reader down through every screen to serve a rare tap
// would be a lot of plumbing for a service that is naturally global, the way
// `logStore` and the toast store already are.
//
// A fetched source is delivered into the working document through the same
// additive media merge the IndexedDB cache uses (`mergeInlineMedia`), so it is
// **not** an edit: it doesn't mark the document dirty or push anything back to
// the drive. It just means the next tap is instant.

import { bytesToDataUrl } from "@niclaslindstedt/oss-framework/files";

import { logStore } from "./log.ts";
import type { MediaSource } from "./mediaHydrate.ts";
import type { ContactPhoto } from "./types.ts";

const log = logStore.createLogger("photos");

/** Reads one archival file's bytes off the active backend. */
type SourceReader = (path: string) => Promise<Uint8Array | null>;

let reader: SourceReader | null = null;
let deliver: ((source: MediaSource) => void) | null = null;

/** In-flight reads, keyed by path, so a card whose photo is tapped twice — or a
 *  lightbox that asks for a whole gallery at once — issues one request per
 *  file. */
const pending = new Map<string, Promise<string | null>>();

/** Wire the on-demand reader to the active backend. Called by the sync engine
 *  whenever the connected backend changes; passing nulls (no backend, an
 *  encrypted copy, or the fake-data takeover) disables on-demand fetching, and
 *  callers fall back to whatever bytes the working copy already holds. */
export function setPhotoSourceReader(
  next: SourceReader | null,
  onLoaded: ((source: MediaSource) => void) | null,
): void {
  reader = next;
  deliver = onLoaded;
  pending.clear();
}

/** The best bytes available *right now* for showing a photo full-screen or
 *  re-cropping it: the kept original if this device has it, else the display
 *  crop, else the atlas tile. Never a round-trip — pair it with
 *  {@link fetchPhotoSource} when a better copy is worth waiting for. */
export function bestSource(photo: ContactPhoto): string | null {
  return photo.photoSource ?? photo.photo ?? photo.photoTile ?? null;
}

/** Whether a better copy than {@link bestSource} could be fetched — the photo
 *  has an archival file on the backend and this device isn't holding its bytes
 *  yet. */
export function canFetchSource(photo: ContactPhoto): boolean {
  return !photo.photoSource && !!photo.photoSourcePath && reader !== null;
}

/** Fetch one photo's kept original, hand it to the working document, and return
 *  it. Resolves to the best already-available copy when there's nothing to
 *  fetch or the fetch fails — so a caller can always just use what comes back.
 *
 *  Failures are logged and swallowed: not getting the original is a photo shown
 *  at crop resolution, never an error the user needs to see. */
export async function fetchPhotoSource(
  contactId: string,
  photo: ContactPhoto,
): Promise<string | null> {
  if (photo.photoSource) return photo.photoSource;
  const path = photo.photoSourcePath;
  if (!path || !reader) return bestSource(photo);

  const inFlight = pending.get(path);
  if (inFlight) return (await inFlight) ?? bestSource(photo);

  const read = reader;
  const job = (async () => {
    try {
      const bytes = await read(path);
      if (!bytes) {
        log.warn(`no file at ${path} — showing the crop instead`);
        return null;
      }
      const url = bytesToDataUrl("image/jpeg", bytes);
      deliver?.({
        contacts: [
          { id: contactId, photos: [{ id: photo.id, photoSource: url }] },
        ],
      });
      log.info(`fetched the original for ${path}`);
      return url;
    } catch (err) {
      log.warn(`could not fetch ${path} (${errMsg(err)})`);
      return null;
    } finally {
      pending.delete(path);
    }
  })();
  pending.set(path, job);
  return (await job) ?? bestSource(photo);
}

/** Fetch the originals of a whole gallery — what opening the full-screen viewer
 *  wants, since it pages through every photo on the card. Fire-and-forget: each
 *  arrival lands in the document and re-renders the page that needs it. */
export function prefetchGallerySources(
  contactId: string,
  photos: readonly ContactPhoto[],
): void {
  for (const photo of photos) {
    if (canFetchSource(photo)) void fetchPhotoSource(contactId, photo);
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
