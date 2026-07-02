// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_NAMESPACE_SLUG } from "@niclaslindstedt/oss-framework/namespaces";

import { parseDoc, serializeDoc } from "./migrations.ts";
import { starterDoc } from "./seed.ts";
import type { AppData, Contact, Folder } from "./types.ts";
import { splitFullName } from "./types.ts";

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

function load(slug: string): AppData {
  try {
    const raw = localStorage.getItem(docKey(slug));
    // Run the persisted bytes forward to the latest version before the app
    // sees them (see `migrations.ts`).
    if (raw) return parseDoc(raw);
  } catch {
    // Corrupt or unavailable storage — fall back to the starter document.
  }
  return starterDoc();
}

/** Write a namespace's document to its localStorage key. Used to push a
 *  contact / folder *into another namespace's* document — the one the active
 *  store isn't holding. */
function persistDoc(slug: string, doc: AppData): void {
  localStorage.setItem(docKey(slug), serializeDoc(doc));
}

/** Pick the active contact after a delete/archive: keep the current one if
 *  it's still visible, otherwise fall to the first un-archived card — so
 *  removing the open card never leaves the screen pointed at a gone one. */
function nextActiveId(contacts: Contact[], current: string): string {
  if (contacts.some((c) => c.id === current && !c.archived)) return current;
  return contacts.find((c) => !c.archived)?.id ?? current;
}

export type ContactStore = ReturnType<typeof useContactStore>;

export function useContactStore(slug: string) {
  // The active slug travels *with* the document in state so the persist effect
  // can never write one namespace's data under another's key (the clobber a
  // separate `data` + `slug` state would race into on a switch).
  const [state, setState] = useState(() => ({ slug, data: load(slug) }));
  // Edit history. `setActive` replaces the present without pushing, so
  // navigation never clutters undo; every content edit goes through `commit`.
  const past = useRef<AppData[]>([]);
  const future = useRef<AppData[]>([]);
  const [version, setVersion] = useState(0); // re-render on history change

  // Namespace switch — adopt that namespace's document and reset history.
  // Adjusting state during render (rather than in an effect) is React's
  // blessed way to respond to a changed input with no stale-doc flash.
  if (state.slug !== slug) {
    past.current = [];
    future.current = [];
    setState({ slug, data: load(slug) });
  }

  const data = state.data;

  useEffect(() => {
    try {
      localStorage.setItem(docKey(state.slug), serializeDoc(state.data));
    } catch {
      // Storage full / unavailable — the in-memory state still works.
    }
  }, [state]);

  const commit = useCallback((next: AppData) => {
    setState((prev) => {
      past.current.push(prev.data);
      future.current = [];
      return { ...prev, data: next };
    });
    setVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setState((cur) => {
      future.current.push(cur.data);
      return { ...cur, data: prev };
    });
    setVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setState((cur) => {
      past.current.push(cur.data);
      return { ...cur, data: next };
    });
    setVersion((v) => v + 1);
  }, []);

  // Re-read the persisted document from localStorage, picking up edits made in
  // another tab. Drives the pull-to-refresh gesture. Replaces the present
  // without touching the undo history (a refresh isn't an edit you'd undo).
  const reload = useCallback(() => {
    setState((cur) => ({ ...cur, data: load(cur.slug) }));
    setVersion((v) => v + 1);
  }, []);

  // Adopt a document that arrived from a sync backend: persist it under the
  // active namespace's key and make it the present. History is cleared — the
  // remote copy is a new baseline, not an edit. Bumps the version counter by
  // exactly one (the sync engine relies on that to re-baseline `dirty`).
  const adoptRemote = useCallback((text: string) => {
    setState((cur) => {
      try {
        const doc = parseDoc(text);
        past.current = [];
        future.current = [];
        return { ...cur, data: doc };
      } catch {
        return cur; // Unparseable remote bytes — keep the local document.
      }
    });
    setVersion((v) => v + 1);
  }, []);

  const setActive = useCallback((id: string) => {
    setState((prev) =>
      prev.data.activeContactId === id
        ? prev
        : { ...prev, data: { ...prev.data, activeContactId: id } },
    );
  }, []);

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
        folderId,
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

  // Patch a card's fields — the contact screen's field commits land here, one
  // undoable step per committed field.
  const updateContact = useCallback(
    (id: string, patch: Partial<Contact>) =>
      commit({
        ...data,
        contacts: data.contacts.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      }),
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

  // Create a folder under a user-picked name and return its id. The name is
  // collected inline before this fires.
  const addFolder = useCallback(
    (name: string): string => {
      const id = freshId("folder");
      const folder: Folder = { id, name };
      commit({ ...data, folders: [...data.folders, folder] });
      return id;
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

  // Delete a folder — its contacts aren't lost: they're reparented to the root
  // so deleting a folder never silently takes its cards with it. Undoable.
  const deleteFolder = useCallback(
    (id: string) =>
      commit({
        ...data,
        folders: data.folders.filter((f) => f.id !== id),
        contacts: data.contacts.map((c) =>
          c.folderId === id ? { ...c, folderId: null } : c,
        ),
      }),
    [commit, data],
  );

  // Archive a folder — tucks the folder and its contacts out of the menu (the
  // Archive counter tallies them); a held flag, not a delete.
  const archiveFolder = useCallback(
    (id: string) => {
      const contacts = data.contacts.map((c) =>
        c.folderId === id ? { ...c, archived: true } : c,
      );
      commit({
        ...data,
        folders: data.folders.map((f) =>
          f.id === id ? { ...f, archived: true } : f,
        ),
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data],
  );

  // Restore an archived folder — lifts the flag off the folder and every
  // contact it holds, so the whole group reappears just as it left.
  const unarchiveFolder = useCallback(
    (id: string) =>
      commit({
        ...data,
        folders: data.folders.map((f) =>
          f.id === id ? { ...f, archived: false } : f,
        ),
        contacts: data.contacts.map((c) =>
          c.folderId === id ? { ...c, archived: false } : c,
        ),
      }),
    [commit, data],
  );

  // Permanently delete an archived folder and every contact under it — the
  // archive is the one place a card leaves the document for good. Undoable.
  const deleteArchivedFolder = useCallback(
    (id: string) =>
      commit({
        ...data,
        folders: data.folders.filter((f) => f.id !== id),
        contacts: data.contacts.filter((c) => c.folderId !== id),
      }),
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

  // Move a contact into *another* namespace — dropping it onto a workspace row
  // in the side menu. The target document lives under a different localStorage
  // key, so we read it, append a fresh-id copy (reset to the root — the target
  // has no matching folder), write it back, and only then drop the original.
  // The remote write happens first so a storage failure aborts before anything
  // is lost.
  const moveContactToNamespace = useCallback(
    (contactId: string, targetSlug: string) => {
      if (targetSlug === state.slug) return;
      const contact = data.contacts.find((c) => c.id === contactId);
      if (!contact) return;
      try {
        const target = load(targetSlug);
        const moved: Contact = {
          ...contact,
          id: freshId("contact"),
          folderId: null,
        };
        persistDoc(targetSlug, {
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
    [commit, data, state.slug],
  );

  // Move a folder — and every contact it holds — into another namespace.
  const moveFolderToNamespace = useCallback(
    (folderId: string, targetSlug: string) => {
      if (targetSlug === state.slug) return;
      const folder = data.folders.find((f) => f.id === folderId);
      if (!folder) return;
      const folderContacts = data.contacts.filter(
        (c) => c.folderId === folderId,
      );
      try {
        const target = load(targetSlug);
        const newFolderId = freshId("folder");
        const movedFolder: Folder = { ...folder, id: newFolderId };
        const movedContacts: Contact[] = folderContacts.map((c) => ({
          ...c,
          id: freshId("contact"),
          folderId: newFolderId,
        }));
        persistDoc(targetSlug, {
          ...target,
          folders: [...target.folders, movedFolder],
          contacts: [...target.contacts, ...movedContacts],
        });
      } catch {
        return; // Storage unavailable — abort rather than drop the folder.
      }
      const movedIds = new Set(folderContacts.map((c) => c.id));
      const contacts = data.contacts.filter((c) => !movedIds.has(c.id));
      commit({
        ...data,
        folders: data.folders.filter((f) => f.id !== folderId),
        contacts,
        activeContactId: nextActiveId(contacts, data.activeContactId),
      });
    },
    [commit, data, state.slug],
  );

  const activeContact = useMemo(
    () =>
      data.contacts.find((c) => c.id === data.activeContactId) ??
      data.contacts[0],
    [data],
  );

  return {
    data,
    activeContact,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    version,
    setActive,
    addContact,
    updateContact,
    deleteContact,
    archiveContact,
    unarchiveContact,
    addFolder,
    renameFolder,
    deleteFolder,
    archiveFolder,
    unarchiveFolder,
    deleteArchivedFolder,
    moveContactToFolder,
    moveContactToNamespace,
    moveFolderToNamespace,
    reload,
    adoptRemote,
    undo,
    redo,
  };
}
