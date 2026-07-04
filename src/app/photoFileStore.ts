// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Binary photo transport for the cloud backends. The framework's `FileStore` is
// text-only — its `read` does `res.text()` and its `write` sends the string as
// the body — so it can round-trip a base64 string but not raw image bytes: a
// JPEG pushed through it comes back mangled by UTF-8 decoding. This module talks
// to the Dropbox and Google Drive content APIs directly to move *bytes*, so what
// lands on the drive is a genuine `.jpg` you can preview, not a base64 blob.
//
// It leans on the framework's proven text `FileStore` for the metadata-only
// operations that never touch a body (`list`, `remove`) — reusing its Dropbox
// token-refresh and Drive folder-resolution — and only re-implements the two
// operations that carry image bytes (`read`, `write`). The result is the small
// {@link PhotoFileStore} contract the externaliser (see `photoStore.ts`) drives.

import {
  AuthError,
  bearerAuthHeader,
  createDropboxFileStore,
  createGdriveFileStore,
  dropboxApiArg,
  readErrorBody,
  refreshDropboxAccessToken,
  type DropboxAuth,
  type FileStore,
} from "@niclaslindstedt/oss-framework/storage";

import { logStore } from "./log.ts";

/** A byte-level file store: the same shape as the framework's `FileStore` but
 *  `read`/`write` deal in raw bytes rather than text, so image (and, for
 *  attachments, arbitrary) files stay binary end to end. `write` takes an
 *  optional MIME type so a filed attachment lands with the right content type
 *  (a `.pdf` reads as a PDF in the drive, not a JPEG); it defaults to
 *  `image/jpeg`, the photo case. */
export type PhotoFileStore = {
  list(): Promise<string[]>;
  read(path: string): Promise<Uint8Array | null>;
  write(path: string, bytes: Uint8Array, mime?: string): Promise<void>;
  remove(path: string): Promise<void>;
};

const DROPBOX_UPLOAD = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_DOWNLOAD = "https://content.dropboxapi.com/2/files/download";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const JPEG_MIME = "image/jpeg";

// --- Dropbox -----------------------------------------------------------------

/** A binary Dropbox photo store rooted at the app folder. `list`/`remove` reuse
 *  the framework's text store (no body to corrupt); `read`/`write` move bytes
 *  through the content API, refreshing the access token on a 401 the same way
 *  the framework's own store does. */
export function dropboxPhotoFileStore(
  auth: DropboxAuth,
  appKey: string | undefined,
): PhotoFileStore {
  const log = logStore.createLogger("dropbox");
  const meta: FileStore = createDropboxFileStore(auth, { appKey, logger: log });
  let token = auth.accessToken;

  // Run a content request, refreshing the token once on a 401 (mirrors the
  // framework's `createAuthedFetch`). Returns the final response.
  async function authed(
    url: string,
    build: (token: string) => RequestInit,
  ): Promise<Response> {
    let res = await fetch(url, build(token));
    if (res.status === 401 && auth.refreshToken && appKey) {
      token = await refreshDropboxAccessToken(appKey, auth.refreshToken);
      auth.onAccessTokenRefreshed(token);
      res = await fetch(url, build(token));
    }
    return res;
  }

  return {
    list: () => meta.list().then((e) => e.map((f) => f.path)),
    remove: (path) => meta.remove(path),
    async read(path) {
      const res = await authed(DROPBOX_DOWNLOAD, (t) => ({
        method: "POST",
        headers: {
          ...bearerAuthHeader(t),
          "Dropbox-API-Arg": dropboxApiArg({ path: `/${path}` }),
        },
      }));
      if (res.status === 409) return null; // path/not_found
      if (!res.ok) {
        throw new Error(`Dropbox download failed: ${res.status}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    },
    // Dropbox stores the bytes verbatim and infers the type from the path's
    // extension, so the upload body is always octet-stream — the `mime` hint is
    // unused here (it matters only for the Drive content type).
    async write(path, bytes) {
      const res = await authed(DROPBOX_UPLOAD, (t) => ({
        method: "POST",
        headers: {
          ...bearerAuthHeader(t),
          "Dropbox-API-Arg": dropboxApiArg({
            path: `/${path}`,
            mode: "overwrite",
            mute: true,
          }),
          "Content-Type": "application/octet-stream",
        },
        body: bytes as BodyInit,
      }));
      if (!res.ok) {
        throw new Error(`Dropbox upload failed: ${res.status}`);
      }
    },
  };
}

// --- Google Drive ------------------------------------------------------------

/** A binary Google Drive photo store in the app folder's `photos/` tree.
 *  `list`/`remove` reuse the framework's text store (folder resolution and all);
 *  `read`/`write` move bytes through the media-upload endpoint. */
export function gdrivePhotoFileStore(token: string): PhotoFileStore {
  const log = logStore.createLogger("gdrive");
  const meta: FileStore = createGdriveFileStore(token, {
    appFolderName: "Contacts",
    logger: log,
  });
  const auth = () => bearerAuthHeader(token);
  const dirIds = new Map<string, string>();

  async function searchOne(query: string): Promise<string | null> {
    const url = `${DRIVE_FILES}?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id)`;
    const res = await fetch(url, { headers: auth() });
    if (!res.ok)
      throw driveError("search", res.status, await readErrorBody(res));
    const json = (await res.json()) as { files?: { id: string }[] };
    return json.files?.[0]?.id ?? null;
  }

  async function createFolder(
    name: string,
    parentId: string | null,
  ): Promise<string> {
    const body: { name: string; mimeType: string; parents?: string[] } = {
      name,
      mimeType: FOLDER_MIME,
    };
    if (parentId) body.parents = [parentId];
    const res = await fetch(`${DRIVE_FILES}?fields=id`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw driveError("folder", res.status, await readErrorBody(res));
    return ((await res.json()) as { id: string }).id;
  }

  // Resolve (creating when asked) the id of a folder path under "Contacts".
  async function resolveDir(
    relDir: string,
    create: boolean,
  ): Promise<string | null> {
    const cached = dirIds.get(relDir);
    if (cached) return cached;
    let appId = await searchOne(
      `name='Contacts' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`,
    );
    if (!appId) {
      if (!create) return null;
      appId = await createFolder("Contacts", null);
    }
    let parentId = appId;
    for (const seg of relDir.split("/").filter(Boolean)) {
      let id = await searchOne(
        `name='${seg}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`,
      );
      if (!id) {
        if (!create) return null;
        id = await createFolder(seg, parentId);
      }
      parentId = id;
    }
    dirIds.set(relDir, parentId);
    return parentId;
  }

  function split(path: string): { dir: string; name: string } {
    const i = path.lastIndexOf("/");
    return i === -1
      ? { dir: "", name: path }
      : { dir: path.slice(0, i), name: path.slice(i + 1) };
  }

  async function fileId(path: string): Promise<string | null> {
    const { dir, name } = split(path);
    const dirId = await resolveDir(dir, false);
    if (!dirId) return null;
    return searchOne(
      `name='${name}' and '${dirId}' in parents and trashed=false`,
    );
  }

  return {
    list: () => meta.list().then((e) => e.map((f) => f.path)),
    remove: (path) => meta.remove(path),
    async read(path) {
      const id = await fileId(path);
      if (!id) return null;
      const res = await fetch(`${DRIVE_FILES}/${id}?alt=media`, {
        headers: auth(),
      });
      if (res.status === 404) return null;
      if (!res.ok)
        throw driveError("download", res.status, await readErrorBody(res));
      return new Uint8Array(await res.arrayBuffer());
    },
    async write(path, bytes, mime) {
      const { dir, name } = split(path);
      const dirId = await resolveDir(dir, true);
      if (!dirId) throw new Error(`Google Drive: cannot resolve ${dir}`);
      const existing = await searchOne(
        `name='${name}' and '${dirId}' in parents and trashed=false`,
      );
      // Upload the raw bytes: PATCH an existing file's media, or create the file
      // (metadata first, so it lands with the right name/parent) then its media.
      // The content type defaults to JPEG (the photo case); an attachment passes
      // its own so a filed PDF is stored as a PDF.
      const id = existing ?? (await createEmpty(dirId, name));
      const res = await fetch(`${DRIVE_UPLOAD}/${id}?uploadType=media`, {
        method: "PATCH",
        headers: { ...auth(), "Content-Type": mime ?? JPEG_MIME },
        body: bytes as BodyInit,
      });
      if (!res.ok)
        throw driveError("upload", res.status, await readErrorBody(res));
    },
  };

  async function createEmpty(parentId: string, name: string): Promise<string> {
    const res = await fetch(`${DRIVE_FILES}?fields=id`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ name, parents: [parentId] }),
    });
    if (!res.ok)
      throw driveError("create", res.status, await readErrorBody(res));
    return ((await res.json()) as { id: string }).id;
  }

  function driveError(op: string, status: number, body: string): Error {
    const message = `Google Drive ${op} failed: ${status} ${body}`;
    return status === 401 ? new AuthError(message) : new Error(message);
  }
}
