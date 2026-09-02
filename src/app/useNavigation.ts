// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useState } from "react";

import { unlock } from "@niclaslindstedt/oss-framework/achievements";

import { parseRoute, type AppRoute, type AppView } from "./route.ts";
import { useAppRoute } from "./useAppRoute.ts";
import type { ContactStore } from "./useContactStore.ts";

// Where the app is, and how it got there — the shell's navigation state, kept
// in step with the browser's history so Back and Forward step between the
// contacts you opened (see `route.ts` for the model, `useAppRoute.ts` for the
// history plumbing). The screens drive it through the returned setters exactly
// as they drove the plain `useState` pair this replaced.
export type Navigation = {
  /** The top-level screen the main area shows. */
  view: AppView;
  setView: (view: AppView) => void;
  /**
   * Whether a card is open. A card never takes over the main area — it always
   * floats in the swipe-down modal over the browse page underneath, whether it
   * was reached from a list row, the side menu, or a search hit — so closing it
   * lands back on the list rather than on whatever screen came before.
   */
  contactModalOpen: boolean;
  setContactModalOpen: (open: boolean) => void;
};

export function useNavigation({
  store,
  closeDrawer,
}: {
  store: ContactStore;
  /** Get the phone drawer out of the way when a history step lands. */
  closeDrawer: () => void;
}): Navigation {
  // Where the address bar says we are on this load: a shared or bookmarked
  // `#/list/<id>` link, a reload of wherever you were, or — for a plain URL
  // with no hash — the List page, the overview of every contact. Read once;
  // `useAppRoute` owns every step after it.
  const bootRoute = useMemo(() => parseRoute(window.location.hash), []);
  const [view, setView] = useState<AppView>(bootRoute.view);
  const [contactModalOpen, setContactModalOpen] = useState(
    bootRoute.contactId !== null,
  );

  const setActive = store.setActive;
  const canOpen = useCallback(
    // Archived cards are hidden from the browse screens rather than dropped
    // from the document, so "openable" means present *and* not filed away.
    (id: string) => store.data.contacts.some((c) => c.id === id && !c.archived),
    [store.data.contacts],
  );

  // Point the store at the card the address bar named. Runs once, against the
  // document as it loaded from storage: a link to a card this address book
  // doesn't hold (a stale bookmark, another namespace's contact) falls back to
  // the browse page bare rather than opening whichever card happens to be first.
  useEffect(() => {
    if (!bootRoute.contactId) return;
    if (canOpen(bootRoute.contactId)) setActive(bootRoute.contactId);
    else setContactModalOpen(false);
    // Boot-only — the history owns every navigation after this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The place the app is in, as the history sees it: the browse screen showing
  // in the main area, plus whichever card is floating over it. Nothing is open
  // on the browse pages themselves or in the archive.
  const activeId = store.activeContact?.id ?? null;
  const route = useMemo<AppRoute>(
    () => ({ view, contactId: contactModalOpen ? activeId : null }),
    [view, contactModalOpen, activeId],
  );

  useAppRoute({
    route,
    canOpen,
    onPop: (next) => {
      // The framework inputs commit on blur and React fires none when the card
      // unmounts, so blur whatever was focused before the step lands — the same
      // reason the shell's `closeContactModal` does.
      (document.activeElement as HTMLElement | null)?.blur?.();
      // A card deleted or archived since that entry was written can't be
      // reopened; that step lands on the browse page bare instead of a stale
      // card.
      const id =
        next.contactId && canOpen(next.contactId) ? next.contactId : null;
      if (id) setActive(id);
      setView(next.view);
      setContactModalOpen(id !== null);
      closeDrawer();
      unlock("backtracker");
    },
  });

  return { view, setView, contactModalOpen, setContactModalOpen };
}
