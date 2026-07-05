// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_NAMESPACE_SLUG } from "@niclaslindstedt/oss-framework/namespaces";

import { dueContacts, isoDate } from "./autoArchive.ts";
import { canNestFolder, subtreeFolderIds } from "./contactList.ts";
import type { ImportedContact } from "./import.ts";
import { mergeContactDraft, type ImportMerge } from "./importMerge.ts";
import { parseDoc, serializeDoc } from "./migrations.ts";
import { starterDoc } from "./seed.ts";
import type { AppData, Contact, Folder } from "./types.ts";
import { splitFullName } from "./types.ts";
import * as output from "../output.ts";

// The app's data store. Holds one namespace's document in state, persists it
// to a per-namespace localStorage key, and exposes the edit actions the
// screens drive — editing cards, adding contacts / folders, switching the
// active card — over an undo / redo history. This is the "store stays in the
// app" seam: the framework owns storage adapters, namespaces, and the UI kit;
// this hook owns where each namespace's document lives and how edits stack up.
//
// The store is keyed by the active namespace slug. Switching namespaces hands
// this hook a new slug; it adopts that namespace's document and resets the
// undo history, so each workspace keeps its own data and its own history.

const DOC_KEY_PREFIX = "contacts:doc";

/** localStorage key for a namespace's document. The default namespace keeps
 *  the un-suffixed key; every other namespace gets a per-slug suffix. */
export function docKey(slug: string): string {
  return slug === DEFAULT_NAMESPACE_SLUG
    ? DOC_KEY_PREFIX
    : `${DOC_KEY_PREFIX}:${slug}`;
}

// Mint a unique id for a new contact / folder / field row. A random suffix
// makes the id unique across sessions (and namespaces), so it can never
// collide with an id already on disk; the prefix keeps ids legible while
// debugging.
export function freshId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** The document storage seam. The store never touches `localStorage` directly
 *  — it reads and writes a namespace's document through a `DocBackend`, so a
 *  different backend can *take over storage* without the store changing. Two
 *  implementations exist: the real `localDocBackend` (persists to localStorage)
 *  and the developer in-memory seed backend (`createSeedBackend`), swapped in by
 *  the "Fake data" toggle. Modelled on the checklist project's `StorageAdapter`
 *  seam, narrowed to the app's synchronous per-namespace document. */
export type DocBackend = {
  readonly id: "local" | "dev";
  /** The namespace's current document, or a starter document when empty. */
  load(slug: string): AppData;
  /** Persist a namespace's document. A best-effort sink — it must not throw. */
  save(slug: string, doc: AppData): void;
};

/** Strip the heavy inline media (photo / attachment bytes) from a document,
 *  keeping every contact, field, and cloud-path reference. The last-resort
 *  fallback when the full document won't fit in localStorage: a quota failure
 *  then costs only the locally cached image / file bytes (which a cloud backend
 *  re-hydrates from the externalised copies) — never the contacts themselves. */
function stripInlineMedia(doc: AppData): AppData {
  return {
    ...doc,
    contacts: doc.contacts.map((c) => {
      const next: Contact = { ...c };
      if (next.photos) {
        next.photos = next.photos.map((p) => ({
          ...p,
          photo: undefined,
          photoSource: undefined,
        }));
      }
      if (next.attachments) {
        next.attachments = next.attachments.map((a) => ({
          ...a,
          data: undefined,
        }));
      }
      return next;
    }),
  };
}

/** The real backend: one JSON document per namespace in localStorage, run
 *  through the migration pipeline on the way in and out.
 *
 *  Both directions are *non-destructive*. A document that exists but this build
 *  can't read — most often one a NEWER build already upgraded, then read by a
 *  stale (service-worker-cached) build after an app update — is left on disk
 *  untouched rather than silently replaced with a blank starter, so it comes
 *  back on its own once the update finishes. That "read failed → return an
 *  empty starter → persist it over the only copy" path is how updating the app
 *  used to wipe every contact locally until a cloud re-pull. */
export const localDocBackend: DocBackend = {
  id: "local",
  load(slug) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(docKey(slug));
    } catch {
      // Storage unavailable — nothing to read; boot a fresh document.
      return starterDoc();
    }
    // No stored document yet: a genuine fresh start.
    if (!raw) return starterDoc();
    try {
      // Run the persisted bytes forward to the latest version before the app
      // sees them (see `migrations.ts`).
      return parseDoc(raw);
    } catch (err) {
      // Bytes exist but can't be parsed / migrated (corrupt, or written by a
      // newer build). Keep the original on disk — the caller must NOT persist
      // the starter we return here over it (see the store's persist guard) —
      // and quarantine a copy so it's recoverable even if a later edit does
      // overwrite the live key. Surface the failure rather than losing data
      // silently.
      output.error(
        `Couldn't read the contacts saved on this device — ${
          err instanceof Error ? err.message : String(err)
        }. The stored copy is left untouched and should reappear once the app finishes updating.`,
      );
      try {
        localStorage.setItem(`${docKey(slug)}:unreadable`, raw);
      } catch {
        // No room to quarantine — the live key is still left intact below.
      }
      return starterDoc();
    }
  },
  save(slug, doc) {
    const key = docKey(slug);
    try {
      localStorage.setItem(key, serializeDoc(doc));
      return;
    } catch {
      // Full document didn't fit (quota) or storage is unavailable. Never let
      // that silently drop the user's contacts: retry with a slimmed copy that
      // keeps every contact but sheds the heavy inline photo / attachment bytes.
      try {
        localStorage.setItem(key, serializeDoc(stripInlineMedia(doc)));
        output.warn(
          "This device's storage was full — saved your contacts without cached photo/attachment data (still safe in any connected cloud copy).",
        );
        return;
      } catch {
        output.error(
          "Couldn't save contacts to this device's storage (it may be full). Your contacts stay in memory and in any connected cloud copy.",
        );
      }
    }
  },
};

/** Mint a stored {@link Contact} from an imported draft: a fresh id for the
 *  card and for every one of its rows, filed to the root (the importer doesn't
 *  know the document's folders). */
function mintImported(d: ImportedContact): Contact {
  return {
    id: freshId("contact"),
    firstName: d.firstName,
    lastName: d.lastName,
    ...(d.company ? { company: d.company } : {}),
    ...(d.isCompany ? { isCompany: true } : {}),
    ...(d.homepage ? { homepage: d.homepage } : {}),
    phones: d.phones.map((p) => ({ ...p, id: freshId("phone") })),
    emails: d.emails.map((e) => ({ ...e, id: freshId("email") })),
    addresses: d.addresses.map((a) => ({ ...a, id: freshId("address") })),
    ...(d.birthday ? { birthday: d.birthday } : {}),
    importantDates: d.importantDates.map((x) => ({
      ...x,
      id: freshId("date"),
    })),
    ...(d.notes ? { notes: d.notes } : {}),
    ...(d.photo ? { photos: [{ id: freshId("photo"), photo: d.photo }] } : {}),
    ...(d.attachments && d.attachments.length > 0
      ? {
          attachments: d.attachments.map((a) => ({
            ...a,
            id: freshId("attach"),
          })),
        }
      : {}),
    ...(d.ice ? { ice: true } : {}),
    folderId: null,
    createdAt: new Date().toISOString(),
  };
}

/** Pick the active contact after a delete/archive: keep the current one if
 *  it's still visible, otherwise fall to the first un-archived card — so
 *  removing the open card never leaves the screen pointed at a gone one. */
function nextActiveId(contacts: Contact[], current: string): string {
  if (contacts.some((c) => c.id === current && !c.archived)) return current;
  return contacts.find((c) => !c.archived)?.id ?? current;
}

export type ContactStore = ReturnType<typeof useContactStore>;

export function useContactStore(
  slug: string,
  backend: DocBackend = localDocBackend,
) {
  // Keep the live backend reachable from the memoised callbacks (reload, the
  // cross-namespace moves) without widening their dependency lists.
  const backendRef = useRef(backend);
  backendRef.current = backend;

  // The active slug and the backend travel *with* the document in state, so the
  // persist effect can never write one namespace's data under another's key —
  // and swapping the backend (the "Fake data" takeover) re-adopts cleanly.
  const [state, setState] = useState(() => ({
    slug,
    backend,
    data: backend.load(slug),
  }));
  // Edit history. `setActive` replaces the present without pushing, so
  // navigation never clutters undo; every content edit goes through `commit`.
  const past = useRef<AppData[]>([]);
  const future = useRef<AppData[]>([]);
  const [version, setVersion] = useState(0); // re-render on history change

  // Guards the write-through below: only a real change (an edit, an adopt) may
  // persist. State produced by *loading* a document — the initial mount, a
  // namespace / backend switch, a reload — must NOT be written back, so a blank
  // starter that `load` returned because the stored bytes were momentarily
  // unreadable can never overwrite the real (still-on-disk) copy. That overwrite
  // was the local "an update wiped my contacts" data loss.
  const persistPending = useRef(false);
  const markPersist = useCallback(() => {
    persistPending.current = true;
  }, []);

  // Namespace switch — or a backend takeover (fake data on/off) — adopts the
  // matching document and resets history. Adjusting state during render (rather
  // than in an effect) is React's blessed way to respond to a changed input
  // with no stale-doc flash. Swapping back to the local backend re-reads the
  // real, untouched document.
  if (state.slug !== slug || state.backend !== backend) {
    past.current = [];
    future.current = [];
    setState({ slug, backend, data: backend.load(slug) });
  }

  const data = state.data;

  useEffect(() => {
    // Write-through to whichever backend is active. The local backend persists
    // to localStorage; the fake-data backend keeps the bytes in memory, so a
    // dev session never touches the real address book on disk. Only a real
    // change persists — a load (mount / namespace switch / reload) leaves the
    // stored bytes as they are (see `persistPending`).
    if (!persistPending.current) return;
    persistPending.current = false;
    state.backend.save(state.slug, state.data);
  }, [state]);

  const commit = useCallback(
    (next: AppData) => {
      markPersist();
      setState((prev) => {
        past.current.push(prev.data);
        future.current = [];
        return { ...prev, data: next };
      });
      setVersion((v) => v + 1);
    },
    [markPersist],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    markPersist();
    setState((cur) => {
      future.current.push(cur.data);
      return { ...cur, data: prev };
    });
    setVersion((v) => v + 1);
  }, [markPersist]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    markPersist();
    setState((cur) => {
      past.current.push(cur.data);
      return { ...cur, data: next };
    });
    setVersion((v) => v + 1);
  }, [markPersist]);

  // Re-read the persisted document from localStorage, picking up edits made in
  // another tab. Drives the pull-to-refresh gesture. Replaces the present
  // without touching the undo history (a refresh isn't an edit you'd undo). A
  // reload adopts what's already on disk, so it never marks the state to persist
  // — writing it straight back would defeat the non-destructive load guard.
  const reload = useCallback(() => {
    setState((cur) => ({ ...cur, data: cur.backend.load(cur.slug) }));
    setVersion((v) => v + 1);
  }, []);

  // Adopt a document that arrived from a sync backend: persist it under the
  // active namespace's key and make it the present. History is cleared — the
  // remote copy is a new baseline, not an edit. Bumps the version counter by
  // exactly one (the sync engine relies on that to re-baseline `dirty`).
  const adoptRemote = useCallback(
    (text: string) => {
      let doc: AppData;
      try {
        doc = parseDoc(text);
      } catch {
        return; // Unparseable remote bytes — keep the local document.
      }
      markPersist();
      setState((cur) => {
        past.current = [];
        future.current = [];
        return { ...cur, data: doc };
      });
      setVersion((v) => v + 1);
    },
    [markPersist],
  );

  const setActive = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.data.activeContactId === id) return prev;
        markPersist();
        return { ...prev, data: { ...prev.data, activeContactId: id } };
      });
    },
    [markPersist],
  );

  // Create a contact under a user-typed full name and open it, returning its
  // id. The name is collected inline before this fires — an empty draft never
  // reaches the store.
  const addContact = useCallback(
    (folderId: string | null, fullName: string): string => {
      const id = freshId("contact");
      const contact: Contact = {
        id,
        ...splitFullName(fullName),
        phones: [],
        emails: [],
        addresses: [],
        importantDates: [],
        folderId,
        createdAt: new Date().toISOString(),
      };
      commit({
        ...data,
        contacts: [...data.contacts, contact],
        activeContactId: id,
      });
      return id;
    },
    [commit, data],
  );

  // File a triaged import batch (a vCard / JSON / CSV drop or file pick, after
  // `planImport` and any user-confirmed conflicts — see `useImportFlow`) into
  // the document. `additions` land as new cards with fresh ids; each merge
  // folds its draft into the existing target card, adding only what's missing
  // (see `mergeContactDraft`). The whole batch is one undoable step, and the
  // first new (or merged) card is opened. Returns the counts so the caller can
  // report them. A merge whose target has meanwhile vanished files as a new
  // card rather than being dropped.
  const applyImport = useCallback(
    (plan: {
      additions: readonly ImportedContact[];
      merges: readonly ImportMerge[];
    }): { added: number; merged: number } => {
      const { additions, merges } = plan;
      if (additions.length === 0 && merges.length === 0) {
        return { added: 0, merged: 0 };
      }
      const byId = new Map(data.contacts.map((c) => [c.id, c] as const));
      const orphaned: ImportedContact[] = [];
      let merged = 0;
      let firstMergedId: string | null = null;
      for (const m of merges) {
        const target = byId.get(m.targetId);
        if (!target) {
          orphaned.push(m.draft);
          continue;
        }
        byId.set(m.targetId, mergeContactDraft(target, m.draft, freshId));
        merged += 1;
        firstMergedId ??= m.targetId;
      }
      const minted = [...additions, ...orphaned].map(mintImported);
      const contacts = [
        ...data.contacts.map((c) => byId.get(c.id)!),
        ...minted,
      ];
      commit({
        ...data,
        contacts,
        activeContactId: minted[0]?.id ?? firstMergedId ?? data.activeContactId,
      });
      return { added: minted.length, merged };
    },
    [commit, data],
  );

  // Patch a card's fields — the contact screen's field commits land here, one
  // undoable step per committed field. Every edit refreshes `updatedAt` so the
  // card's foot-of-card stamp tracks when it was last touched (see
  // `ContactReadView`); a card only grows the field the first time it's edited.
  const updateContact = useCallback(
    (id: string, patch: Partial<Contact>) => {
      const updatedAt = new Date().toISOString();
      commit({
        ...data,
        contacts: data.contacts.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt } : c,
        ),
      });
    },
    [commit, data],
  );

  // Delete a contact — the swipe-left trash outcome. Drops it from the
  // document and moves the active pointer off it if it was open. Undoable.
  const deleteContact = useCallback(
    (id: string) => {
      const contacts = data.contacts.filter((c) => c.id !== id);
      commit({
        ...data,
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data],
  );

  // Archive a contact — the swipe-right outcome. Hides it without dropping it
  // and steps the active pointer off it. Undoable.
  const archiveContact = useCallback(
    (id: string) => {
      const contacts = data.contacts.map((c) =>
        c.id === id ? { ...c, archived: true } : c,
      );
      commit({
        ...data,
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data],
  );

  // Delete several contacts in one undoable step — the batch behind select
  // mode's bulk delete. Dropping them one call at a time would stack N undo
  // steps and clobber each other (each call reads the same pre-delete `data`),
  // so the whole set leaves in a single commit. A no-op when none are present.
  const deleteContacts = useCallback(
    (ids: readonly string[]) => {
      const drop = new Set(ids);
      if (!data.contacts.some((c) => drop.has(c.id))) return;
      const contacts = data.contacts.filter((c) => !drop.has(c.id));
      commit({
        ...data,
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data],
  );

  // Archive several contacts in one undoable step — the batch counterpart of
  // `archiveContact`, same single-commit rationale as `deleteContacts`. A
  // no-op when every targeted card is already archived (or missing).
  const archiveContacts = useCallback(
    (ids: readonly string[]) => {
      const set = new Set(ids);
      if (!data.contacts.some((c) => set.has(c.id) && !c.archived)) return;
      const contacts = data.contacts.map((c) =>
        set.has(c.id) ? { ...c, archived: true } : c,
      );
      commit({
        ...data,
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data],
  );

  // Save the hand-picked order of the Favorites page. `orderedIds` is the full
  // favorites list in its new order (top to bottom); each card's
  // `favoriteOrder` is set to its index so the order persists and syncs like
  // any edit. A card not in the list is left untouched. Undoable — one step per
  // settled drag.
  const reorderFavorites = useCallback(
    (orderedIds: readonly string[]) => {
      const rank = new Map(orderedIds.map((id, i) => [id, i]));
      commit({
        ...data,
        contacts: data.contacts.map((c) =>
          rank.has(c.id) ? { ...c, favoriteOrder: rank.get(c.id) } : c,
        ),
      });
    },
    [commit, data],
  );

  // Flip a contact's in-case-of-emergency flag — the "mark as emergency
  // contact" outcome. A flagged card pins to the top of the side menu; toggling
  // it off drops it back to its ordinary spot. Undoable.
  const toggleContactIce = useCallback(
    (id: string) =>
      commit({
        ...data,
        contacts: data.contacts.map((c) =>
          c.id === id ? { ...c, ice: !c.ice } : c,
        ),
      }),
    [commit, data],
  );

  // Restore an archived contact — the Archive page's "restore" outcome. The
  // active pointer is left alone so a restore never yanks the screen onto the
  // recovered card.
  const unarchiveContact = useCallback(
    (id: string) =>
      commit({
        ...data,
        contacts: data.contacts.map((c) =>
          c.id === id ? { ...c, archived: false } : c,
        ),
      }),
    [commit, data],
  );

  // Auto-archive sweep: file away every contact whose scheduled date has
  // arrived (see `autoArchive.ts`) — archived cards are shelved and their
  // schedule cleared so restoring one doesn't re-file it; delete-scheduled
  // cards leave the document for good. Runs on load and on reload; a no-op when
  // nothing is due (no empty undo step), otherwise one undoable step for the
  // whole batch.
  const sweepAutoArchive = useCallback(
    (now: Date = new Date()) => {
      const { toArchive, toDelete } = dueContacts(data.contacts, isoDate(now));
      if (toArchive.length === 0 && toDelete.length === 0) return;
      const deleteIds = new Set(toDelete.map((c) => c.id));
      const archiveIds = new Set(toArchive.map((c) => c.id));
      const contacts = data.contacts
        .filter((c) => !deleteIds.has(c.id))
        .map((c) =>
          archiveIds.has(c.id)
            ? {
                ...c,
                archived: true,
                autoArchiveDate: undefined,
                autoArchiveAction: undefined,
              }
            : c,
        );
      commit({
        ...data,
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data],
  );

  // Create a folder under a user-picked name and return its id. The name is
  // collected inline before this fires. A `parentId` nests the new folder as a
  // subfolder of that folder; the default (`null`) makes a root folder.
  const addFolder = useCallback(
    (name: string, parentId: string | null = null): string => {
      const id = freshId("folder");
      const folder: Folder =
        parentId !== null ? { id, name, parentId } : { id, name };
      commit({ ...data, folders: [...data.folders, folder] });
      return id;
    },
    [commit, data],
  );

  // Reparent a folder — the drag-a-folder-onto-another (nest) or onto-the-root
  // (promote) outcome. Guards keep the tree acyclic: a folder can't nest into
  // itself or into its own subtree, and dropping it back onto its current
  // parent is a harmless no-op (no empty undo step). Moving to `null` lifts it
  // to the top level.
  const moveFolderToFolder = useCallback(
    (folderId: string, parentId: string | null) => {
      const folder = data.folders.find((f) => f.id === folderId);
      if (!folder) return;
      if ((folder.parentId ?? null) === parentId) return;
      if (!canNestFolder(data.folders, folderId, parentId)) return;
      commit({
        ...data,
        folders: data.folders.map((f) =>
          f.id === folderId ? { ...f, parentId } : f,
        ),
      });
    },
    [commit, data],
  );

  // Save the hand-dragged order of the folders — the "manual" folder-sort
  // outcome. `orderedIds` is the new order of the (visible) folders being
  // reordered; they're slotted back into the positions they currently occupy in
  // the document, so any interleaved archived folders keep their place. A card
  // whose id isn't in the list is left untouched. Undoable — one step per
  // settled drag.
  const reorderFolders = useCallback(
    (orderedIds: readonly string[]) => {
      const inOrder = orderedIds
        .map((id) => data.folders.find((f) => f.id === id))
        .filter((f): f is Folder => !!f);
      if (inOrder.length === 0) return;
      const moving = new Set(inOrder.map((f) => f.id));
      let i = 0;
      const folders = data.folders.map((f) =>
        moving.has(f.id) ? inOrder[i++]! : f,
      );
      commit({ ...data, folders });
    },
    [commit, data],
  );

  const renameFolder = useCallback(
    (id: string, name: string) =>
      commit({
        ...data,
        folders: data.folders.map((f) => (f.id === id ? { ...f, name } : f)),
      }),
    [commit, data],
  );

  // Delete a folder — nothing under it is lost: its direct contacts and its
  // direct subfolders are promoted up to the folder's own parent (the root for
  // a top-level folder), so deleting a folder never silently takes its cards or
  // its nested folders with it. Undoable.
  const deleteFolder = useCallback(
    (id: string) => {
      const folder = data.folders.find((f) => f.id === id);
      const parentId = folder?.parentId ?? null;
      commit({
        ...data,
        folders: data.folders
          .filter((f) => f.id !== id)
          .map((f) => (f.parentId === id ? { ...f, parentId } : f)),
        contacts: data.contacts.map((c) =>
          c.folderId === id ? { ...c, folderId: parentId } : c,
        ),
      });
    },
    [commit, data],
  );

  // Archive a folder — tucks the folder, its subfolders, and every contact in
  // the whole subtree out of the menu (the Archive counter tallies them); a
  // held flag, not a delete. A subfolder inherits its parent's fate.
  const archiveFolder = useCallback(
    (id: string) => {
      const folderIds = subtreeFolderIds(data.folders, id);
      const contacts = data.contacts.map((c) =>
        c.folderId !== null && folderIds.has(c.folderId)
          ? { ...c, archived: true }
          : c,
      );
      commit({
        ...data,
        folders: data.folders.map((f) =>
          folderIds.has(f.id) ? { ...f, archived: true } : f,
        ),
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data],
  );

  // Restore an archived folder — lifts the flag off the folder, its subfolders,
  // and every contact the subtree holds, so the whole branch reappears just as
  // it left.
  const unarchiveFolder = useCallback(
    (id: string) => {
      const folderIds = subtreeFolderIds(data.folders, id);
      commit({
        ...data,
        folders: data.folders.map((f) =>
          folderIds.has(f.id) ? { ...f, archived: false } : f,
        ),
        contacts: data.contacts.map((c) =>
          c.folderId !== null && folderIds.has(c.folderId)
            ? { ...c, archived: false }
            : c,
        ),
      });
    },
    [commit, data],
  );

  // Permanently delete an archived folder, its subfolders, and every contact
  // under the subtree — the archive is the one place a card leaves the document
  // for good. Undoable.
  const deleteArchivedFolder = useCallback(
    (id: string) => {
      const folderIds = subtreeFolderIds(data.folders, id);
      commit({
        ...data,
        folders: data.folders.filter((f) => !folderIds.has(f.id)),
        contacts: data.contacts.filter(
          (c) => c.folderId === null || !folderIds.has(c.folderId),
        ),
      });
    },
    [commit, data],
  );

  // Move a contact into a folder (or out to the root, `null`) — the
  // drag-and-drop outcome. Dropping a card back onto the container it already
  // lives in is a no-op, so it never stacks an empty undo step.
  const moveContactToFolder = useCallback(
    (contactId: string, folderId: string | null) => {
      const contact = data.contacts.find((c) => c.id === contactId);
      if (!contact || contact.folderId === folderId) return;
      commit({
        ...data,
        contacts: data.contacts.map((c) =>
          c.id === contactId ? { ...c, folderId } : c,
        ),
      });
    },
    [commit, data],
  );

  // Move several contacts into a folder (or out to the root, `null`) in one
  // undoable step — the batch behind a multi-select drag or "Move to folder".
  // Filing them one at a time would stack N undo steps *and* clobber each other
  // (each call reads the same pre-move `data`), so the whole set moves in a
  // single commit. A no-op when nothing actually changes folder.
  const moveContactsToFolder = useCallback(
    (contactIds: readonly string[], folderId: string | null) => {
      const ids = new Set(contactIds);
      const changes = data.contacts.some(
        (c) => ids.has(c.id) && c.folderId !== folderId,
      );
      if (!changes) return;
      commit({
        ...data,
        contacts: data.contacts.map((c) =>
          ids.has(c.id) ? { ...c, folderId } : c,
        ),
      });
    },
    [commit, data],
  );

  // Move a contact into *another* namespace — dropping it onto a workspace row
  // in the side menu. The target document lives under a different backend key,
  // so we read it, append a fresh-id copy (reset to the root — the target has
  // no matching folder), write it back, and only then drop the original. The
  // target write happens first so a storage failure aborts before anything is
  // lost. Both reads and writes go through the active backend, so a fake-data
  // session moves cards between in-memory namespaces without touching disk.
  const moveContactToNamespace = useCallback(
    (contactId: string, targetSlug: string) => {
      if (targetSlug === state.slug) return;
      const contact = data.contacts.find((c) => c.id === contactId);
      if (!contact) return;
      try {
        const target = state.backend.load(targetSlug);
        const moved: Contact = {
          ...contact,
          id: freshId("contact"),
          folderId: null,
        };
        state.backend.save(targetSlug, {
          ...target,
          contacts: [...target.contacts, moved],
        });
      } catch {
        return; // Storage unavailable — abort rather than drop the contact.
      }
      const contacts = data.contacts.filter((c) => c.id !== contactId);
      commit({
        ...data,
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data, state.slug, state.backend],
  );

  // Move a folder — its whole subtree of subfolders, and every contact any of
  // them holds — into another namespace. Every folder and card gets a fresh id;
  // the subtree's internal parent links are rewired onto the new ids so the
  // nesting survives the move, and the dragged folder lands at the target's
  // root (its old parent doesn't exist there).
  const moveFolderToNamespace = useCallback(
    (folderId: string, targetSlug: string) => {
      if (targetSlug === state.slug) return;
      const folder = data.folders.find((f) => f.id === folderId);
      if (!folder) return;
      const folderIds = subtreeFolderIds(data.folders, folderId);
      const movingFolders = data.folders.filter((f) => folderIds.has(f.id));
      const movingContacts = data.contacts.filter(
        (c) => c.folderId !== null && folderIds.has(c.folderId),
      );
      // Old id → fresh id, so a subfolder's `parentId` can be rewired onto the
      // moved copies rather than dangling at an id the target doesn't have.
      const idMap = new Map(
        movingFolders.map((f) => [f.id, freshId("folder")]),
      );
      try {
        const target = state.backend.load(targetSlug);
        const movedFolders: Folder[] = movingFolders.map((f) => {
          const parentId = f.parentId ?? null;
          // The dragged folder's parent isn't part of the move — it roots at the
          // target; an inner folder keeps its (remapped) parent.
          const nextParent =
            parentId !== null && idMap.has(parentId)
              ? idMap.get(parentId)!
              : null;
          return nextParent !== null
            ? { ...f, id: idMap.get(f.id)!, parentId: nextParent }
            : { ...f, id: idMap.get(f.id)!, parentId: undefined };
        });
        const movedContacts: Contact[] = movingContacts.map((c) => ({
          ...c,
          id: freshId("contact"),
          folderId: idMap.get(c.folderId!)!,
        }));
        state.backend.save(targetSlug, {
          ...target,
          folders: [...target.folders, ...movedFolders],
          contacts: [...target.contacts, ...movedContacts],
        });
      } catch {
        return; // Storage unavailable — abort rather than drop the folder.
      }
      const movedContactIds = new Set(movingContacts.map((c) => c.id));
      const contacts = data.contacts.filter((c) => !movedContactIds.has(c.id));
      commit({
        ...data,
        folders: data.folders.filter((f) => !folderIds.has(f.id)),
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data, state.slug, state.backend],
  );

  const activeContact = useMemo(
    () =>
      data.contacts.find((c) => c.id === data.activeContactId) ??
      data.contacts[0],
    [data],
  );

  return {
    data,
    /** The namespace slug the live document belongs to — so backup file names
     *  and cross-namespace features can key off it. */
    slug: state.slug,
    activeContact,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    version,
    setActive,
    addContact,
    applyImport,
    updateContact,
    deleteContact,
    deleteContacts,
    archiveContact,
    archiveContacts,
    unarchiveContact,
    toggleContactIce,
    reorderFavorites,
    sweepAutoArchive,
    addFolder,
    moveFolderToFolder,
    reorderFolders,
    renameFolder,
    deleteFolder,
    archiveFolder,
    unarchiveFolder,
    deleteArchivedFolder,
    moveContactToFolder,
    moveContactsToFolder,
    moveContactToNamespace,
    moveFolderToNamespace,
    reload,
    adoptRemote,
    undo,
    redo,
  };
}
