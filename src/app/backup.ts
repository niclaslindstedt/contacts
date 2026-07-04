// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Timestamped, self-contained backups of a namespace's document. A backup is a
// ZIP archive holding a single `contacts.json` — the whole serialized document
// with photos and attachments inline — so it round-trips everything a contact
// carries, independent of which backend externalises those files day to day.
// The ZIP is deflate-compressed (see `zip.ts`), which claws back most of the
// base64 bloat those inline images add.
//
// Backups live in a `backups/` folder on whichever file-backed backend is
// active (a picked local folder, Dropbox, or Google Drive), one file per
// snapshot, named `contacts-<slug>-<ts>-c<n>-f<m>.zip`. The counts and
// timestamp ride in the file name so the browse list renders instantly from a
// directory listing alone — no need to download every archive to describe it.
//
// The byte transport is the very same `PhotoFileStore` the photo/attachment
// externalisers already use for each backend (`photoFileStore.ts`,
// `folderFileStore.ts`), scoped here to the `backups/` subtree — so backups
// reuse the proven auth, refresh, and folder-resolution paths rather than
// re-implementing them.

import { type DropboxAuth } from "@niclaslindstedt/oss-framework/storage";

import { serializeDoc } from "./migrations.ts";
import {
  dropboxPhotoFileStore,
  gdrivePhotoFileStore,
  type PhotoFileStore,
} from "./photoFileStore.ts";
import { folderFileStore } from "./folderFileStore.ts";
import type { AppData } from "./types.ts";
import { createZip, readZip } from "./zip.ts";

/** The single file inside every backup archive. */
const BACKUP_DOC = "contacts.json";
/** The subfolder every backup archive is filed under on the active backend. */
export const BACKUP_ROOT = "backups";

/** The byte-level store the backup surface drives — the same shape the photo /
 *  attachment transports expose, scoped to the `backups/` subtree so `list`
 *  only ever reports backup archives. */
export type BackupStore = PhotoFileStore;

/** Scope a byte file store to the `backups/` tree at the backend's root. */
function scopeToBackups(files: PhotoFileStore): BackupStore {
  return {
    async list() {
      const paths = await files.list();
      return paths.filter((p) => p.startsWith(`${BACKUP_ROOT}/`));
    },
    read: (path) => files.read(path),
    write: (path, bytes, mime) => files.write(path, bytes, mime),
    remove: (path) => files.remove(path),
  };
}

/** The Dropbox backup store, rooted at the app folder's `backups/` tree. */
export function dropboxBackupStore(
  auth: DropboxAuth,
  appKey: string | undefined,
): BackupStore {
  return scopeToBackups(dropboxPhotoFileStore(auth, appKey));
}

/** The Google Drive backup store, in the app folder's `backups/` tree. */
export function gdriveBackupStore(token: string): BackupStore {
  return scopeToBackups(gdrivePhotoFileStore(token));
}

/** The local-folder backup store, in the picked directory's `backups/` tree. */
export function folderBackupStore(
  root: FileSystemDirectoryHandle,
  onPermissionLost?: () => void,
): BackupStore {
  return scopeToBackups(folderFileStore(root, onPermissionLost));
}

// -- archive contents ---------------------------------------------------------

/** Pack a document into a backup archive: one deflate-compressed `contacts.json`
 *  carrying the full serialized document (photos and attachments inline). */
export async function createBackupZip(
  data: AppData,
  modifiedAt?: Date,
): Promise<Uint8Array> {
  const json = new TextEncoder().encode(serializeDoc(data));
  return createZip([{ name: BACKUP_DOC, data: json }], modifiedAt);
}

/** Extract the document text from a backup archive, ready for
 *  `store.adoptRemote`. Throws when the archive doesn't hold a `contacts.json`
 *  (a stray ZIP, or a truncated download). */
export async function readBackupDoc(bytes: Uint8Array): Promise<string> {
  const entries = await readZip(bytes);
  const doc = entries.find((e) => e.name === BACKUP_DOC);
  if (!doc) throw new Error("This ZIP is not a contacts backup");
  return new TextDecoder().decode(doc.data);
}

// -- file names ---------------------------------------------------------------

/** A parsed backup file: its path on the backend, when it was taken, and what it
 *  held — everything the browse list needs, all recovered from the file name. */
export type BackupInfo = {
  /** Full path under the backend, e.g. `backups/contacts-default-…-c12-f3.zip`. */
  path: string;
  /** When the snapshot was taken (from the embedded timestamp). */
  date: Date;
  /** Contact count at backup time, or null when the name predates the counts. */
  contacts: number | null;
  /** Folder count at backup time, or null when the name predates the counts. */
  folders: number | null;
};

/** Two-digit zero-pad for the timestamp fields. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The filesystem-safe timestamp stem — `YYYY-MM-DDTHH-MM-SS` in local time, so
 *  a backup's name reads in the user's own clock (matching the browse list). */
function stamp(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

/** The path a fresh backup of `data` for `slug` is written to. */
export function backupPath(slug: string, data: AppData, date: Date): string {
  const name =
    `contacts-${slug}-${stamp(date)}` +
    `-c${data.contacts.length}-f${data.folders.length}.zip`;
  return `${BACKUP_ROOT}/${name}`;
}

/** A clean, user-facing backup file name for a moment in time (no slug or count
 *  noise) — the download name and the browse row's monospace title. */
export function backupFileName(date: Date = new Date()): string {
  return `contacts-${stamp(date)}.zip`;
}

/** The clean file name for an existing backup row. */
export function backupDisplayName(info: BackupInfo): string {
  return backupFileName(info.date);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse the backup list for one namespace out of a directory listing, newest
 *  first. Paths that don't match this slug's backup naming are ignored, so a
 *  sibling namespace's archives never leak into the list. */
export function parseBackups(
  paths: readonly string[],
  slug: string,
): BackupInfo[] {
  const re = new RegExp(
    `^${BACKUP_ROOT}/contacts-${escapeRegExp(slug)}-` +
      `(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2})-(\\d{2})-(\\d{2})` +
      `(?:-c(\\d+)-f(\\d+))?\\.zip$`,
  );
  const out: BackupInfo[] = [];
  for (const path of paths) {
    const m = re.exec(path);
    if (!m) continue;
    const [, y, mo, d, h, mi, s, c, f] = m;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
    );
    out.push({
      path,
      date,
      contacts: c === undefined ? null : Number(c),
      folders: f === undefined ? null : Number(f),
    });
  }
  out.sort((a, b) => b.date.getTime() - a.date.getTime());
  return out;
}

/** Format a backup's timestamp for the browse list — `YYYY-MM-DD HH:MM`, the
 *  same locale-neutral shape the mock uses. */
export function formatBackupDate(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
