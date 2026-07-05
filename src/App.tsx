// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  useApplyTheme,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";
import {
  Sidebar,
  useEdgeSwipeOpen,
  usePersistentMenuPosition,
  useSidebarInset,
} from "@niclaslindstedt/oss-framework/sidebar";
import {
  Modal,
  SpinnerIcon,
  ToastViewport,
} from "@niclaslindstedt/oss-framework/components";
import { UpdateToast, usePwaUpdate } from "@niclaslindstedt/oss-framework/pwa";
import { SyncDetailsModal } from "@niclaslindstedt/oss-framework/sync";
import { ChangelogModal } from "@niclaslindstedt/oss-framework/changelog";
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";
import {
  useMediaQuery,
  useUndoRedoShortcuts,
} from "@niclaslindstedt/oss-framework/hooks";
import { glyphDataUri } from "@niclaslindstedt/oss-framework/glyphs";
import {
  NamespacesModal,
  applyFaviconHref,
  namespaceFaviconHref,
} from "@niclaslindstedt/oss-framework/namespaces";
import {
  AchievementUnlockModal,
  AchievementsModal,
  TrophyButton,
  unlock,
  useAchievementWatcher,
} from "@niclaslindstedt/oss-framework/achievements";

import { ArchiveScreen } from "./app/ArchiveScreen.tsx";
import { CloudSetupModal } from "./app/CloudSetupModal.tsx";
import { ContactListScreen } from "./app/ContactListScreen.tsx";
import { ContactScreen } from "./app/ContactScreen.tsx";
import { ImportDropZone } from "./app/ImportDropZone.tsx";
import { RELEASES, FEATURE_DOCS } from "./app/changelog.ts";
import { SearchOverlay } from "./app/SearchOverlay.tsx";
import { SettingsModal } from "./app/SettingsModal.tsx";
import { SideMenuContent } from "./app/SideMenuContent.tsx";
import { buildCatalog } from "./app/achievements.ts";
import { useT } from "./app/i18n/index.ts";
import { APP_LOOK } from "./app/look.ts";
import { logStore } from "./app/log.ts";
import { status } from "./output.ts";
import { useAchievements } from "./app/useAchievements.ts";
import { applyBackdropVars, useAppSettings } from "./app/useAppSettings.ts";
import { useDevSeed } from "./app/dev/useDevSeed.ts";
import { createSeedBackend } from "./app/dev/seedBackend.ts";
import { localDocBackend, useContactStore } from "./app/useContactStore.ts";
import { toastStore, UNDO_TOAST_MS } from "./app/toast.ts";
import { useNamespaces } from "./app/useNamespaces.ts";
import { useSyncEngine } from "./app/useSyncEngine.ts";
import { cacheIdForBase } from "./app/pwa.ts";
import { displayName } from "./app/types.ts";

// A local-first contacts PWA built from the framework's shared surface. The
// framework `Sidebar` frames the navigation (docked on wide screens, a
// draggable drawer on phones); the app owns the contact store, the card
// screen, the side-menu content, the real sync engine, and its tabbed
// Settings dialog.
export function App() {
  const t = useT();
  const [appearance, setAppearance] = useState<ThemeAppearance>(APP_LOOK);
  useApplyTheme(appearance);

  // Mirror the active density preset onto `<html>` as a discrete attribute. The
  // framework's theme engine publishes density only as the `--density-row-py` /
  // `--density-row-px` CSS variables (which the row components consume); the
  // attribute lets app-owned CSS key off the three levels by name to tighten
  // the settings cards, the sidebar island, and the footer rail to match.
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-density",
      appearance.ui.density,
    );
  }, [appearance.ui.density]);

  // Namespaces (workspaces). The registry + active pointer live in the app
  // (`useNamespaces`, the framework's "store stays in the app" seam); the
  // document store keys off the active slug, so switching a namespace swaps
  // the whole address book and its undo history.
  const ns = useNamespaces();
  // Developer "Fake data" takeover: when active (via the Developer tab toggle or
  // the `VITE_SEED` build var), an in-memory backend seeded with sample data
  // replaces the real localStorage backend for the session — nothing on disk is
  // touched, and a reload restores the real address book (see `useDevSeed`).
  const devSeed = useDevSeed();
  const backend = useMemo(
    () => (devSeed.active ? createSeedBackend(devSeed.size) : localDocBackend),
    [devSeed.active, devSeed.size],
  );
  const store = useContactStore(ns.activeSlug, backend);
  const [namespacesOpen, setNamespacesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // The top-level view the main area shows: the active contact, the overview
  // List page, the Favorites page, or the Archive page (all reached from the
  // side menu's action grid). The app opens on the **List** page — the overview
  // of every contact — so a fresh launch always lands on the full address book
  // rather than a single card.
  const [view, setView] = useState<
    "contact" | "archive" | "list" | "favorites"
  >("list");
  // A card opened by tapping a row on the List or Favorites page rides in a
  // swipe-down-to-dismiss modal that floats over that page — closing it drops
  // straight back to the browse list underneath. A card reached from the
  // sidebar or a search hit takes over the main area as a full page (`view ===
  // "contact"`) instead, so those two paths never set this.
  const [contactModalOpen, setContactModalOpen] = useState(false);
  // Close the browse-page card modal, saving whatever field the user was
  // mid-edit in. The framework inputs commit on blur, and React fires no blur
  // when the card unmounts, so a swipe- or Escape-close would otherwise drop
  // the in-progress field — blur the active element ourselves first to force
  // its commit. Closing then unmounts the card, which also drops its edit mode:
  // reopening a card lands in read mode. The sidebar full page is deliberately
  // different — it keeps edit mode across contact switches so you can edit one
  // card after another — so only this modal path resets it.
  const closeContactModal = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    setContactModalOpen(false);
  }, []);
  // The "What's new" dialog, opened from the side menu's About dropdown.
  const [changelogOpen, setChangelogOpen] = useState(false);
  const { settings, setSettings } = useAppSettings();

  // The real sync engine — pushes the document to Dropbox / Google Drive when
  // connected (see `useSyncEngine`). The passphrase for the encrypted cloud
  // copy lives only in this in-memory ref; the framework's encryption wrapper
  // reads it fresh on every operation and stores it nowhere.
  const passwordRef = useRef<string | null>(null);
  const sync = useSyncEngine(store, ns.activeSlug, passwordRef, devSeed.active);
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);
  // Applying an update (skip-waiting → the new service worker takes control →
  // the page reloads) has a visible gap. Flip a flag on the tap so the toast
  // shows a spinner instead of a dead button until the reload lands.
  const [reloading, setReloading] = useState(false);

  // Wide screens (≥ the smallest iPad) dock the sidebar permanently; phones
  // collapse it to a draggable drawer.
  const pinned = useMediaQuery("(min-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // True while a sidebar gesture owns the pointer — the floating button being
  // dragged, or a nav row picked up to reparent / archive. Both would
  // otherwise arm the screen's pull-to-refresh behind them.
  const [sidebarDragging, setSidebarDragging] = useState(false);
  // The sidebar button's resting spot is remembered across reloads by the
  // framework's `usePersistentMenuPosition`.
  const [position, setPosition] = usePersistentMenuPosition(
    "contacts:menu-position",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Achievements (Settings → General toggles the feature off). The store is
  // the app's — the framework owns the engine, the bus, and the trophy UI.
  const achievementsEnabled = !settings.disableAchievements;
  const ach = useAchievements();
  const [tourOpen, setTourOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  // The catalog and modal chrome carry translated copy, so both are composed
  // against `t` and memoised on it — a language switch rebuilds them.
  const catalog = useMemo(() => buildCatalog(t), [t]);
  const achievementLabels = useMemo(
    () => ({
      title: t("achievements.modal.title"),
      intro: t("achievements.modal.intro"),
      locked: t("achievements.modal.locked"),
      learnMore: t("achievements.modal.learnMore"),
      close: t("achievements.modal.close"),
      counter: (s: {
        unlocked: number;
        total: number;
        earned: number;
        max: number;
      }) =>
        t("achievements.modal.counter", {
          unlocked: String(s.unlocked),
          total: String(s.total),
        }),
      tierPoints: (s: { earned: number; max: number }) =>
        t("achievements.modal.tierPoints", {
          earned: String(s.earned),
          max: String(s.max),
        }),
      tier: {
        beginner: {
          title: t("achievements.modal.tier.beginner.title"),
          subtitle: t("achievements.modal.tier.beginner.subtitle"),
        },
        intermediate: {
          title: t("achievements.modal.tier.intermediate.title"),
          subtitle: t("achievements.modal.tier.intermediate.subtitle"),
        },
        pro: {
          title: t("achievements.modal.tier.pro.title"),
          subtitle: t("achievements.modal.tier.pro.subtitle"),
        },
        expert: {
          title: t("achievements.modal.tier.expert.title"),
          subtitle: t("achievements.modal.tier.expert.subtitle"),
        },
      },
    }),
    [t],
  );
  const unlockLabels = useMemo(
    () => ({
      titleOne: t("achievements.unlock.titleOne"),
      titleOther: (n: number) =>
        t("achievements.unlock.titleOther", { n: String(n) }),
      dismiss: t("achievements.unlock.dismiss"),
      close: t("achievements.unlock.close"),
    }),
    [t],
  );
  const trophyLabels = useMemo(
    () => ({
      open: t("achievements.trophy.open"),
      unseen: (n: number) => t("achievements.trophy.unseen", { n: String(n) }),
    }),
    [t],
  );

  // Undo lives outside the document state, so its trophy fires through the
  // manual bus rather than a derived predicate.
  const undoWithTrophy = () => {
    store.undo();
    unlock("timeTraveler");
  };

  // The hovering "archived / deleted — undo?" banner. An archive or a delete
  // (from the List page, the sidebar's right-click menu, a drag onto Archive, or
  // the archive screen) raises it with its outcome; the framework toast store
  // owns the auto-dismiss timer. Clearing first keeps it a single banner — a
  // fresh outcome replaces the previous one rather than stacking under it. Its
  // Undo rewinds the archive / delete that raised it (the action's activation
  // dismisses the toast itself).
  const showUndoToast = useCallback(
    (message: string) => {
      toastStore.clear();
      toastStore.push({
        message,
        durationMs: UNDO_TOAST_MS,
        action: {
          label: t("toast.undo"),
          onAction: () => {
            store.undo();
            unlock("timeTraveler");
          },
        },
      });
    },
    [store, t],
  );

  // The store the screens act through: archive / delete of a contact or folder
  // raise the undo toast, and undo carries the trophy. Everything else passes
  // straight through. The screens read the wrapped methods; `store` itself stays
  // the source for the app-level reads (active card, sweep, sync).
  const screenStore = useMemo(
    () => ({
      ...store,
      undo: () => {
        store.undo();
        unlock("timeTraveler");
      },
      archiveContact: (id: string) => {
        store.archiveContact(id);
        showUndoToast(t("toast.contactArchived"));
      },
      deleteContact: (id: string) => {
        store.deleteContact(id);
        showUndoToast(t("toast.contactDeleted"));
      },
      archiveContacts: (ids: readonly string[]) => {
        store.archiveContacts(ids);
        showUndoToast(
          ids.length === 1
            ? t("toast.contactArchived")
            : t("toast.contactsArchived", { n: String(ids.length) }),
        );
      },
      deleteContacts: (ids: readonly string[]) => {
        store.deleteContacts(ids);
        showUndoToast(
          ids.length === 1
            ? t("toast.contactDeleted")
            : t("toast.contactsDeleted", { n: String(ids.length) }),
        );
      },
      archiveFolder: (id: string) => {
        store.archiveFolder(id);
        showUndoToast(t("toast.folderArchived"));
      },
      deleteFolder: (id: string) => {
        store.deleteFolder(id);
        showUndoToast(t("toast.folderDeleted"));
      },
    }),
    [store, showUndoToast, t],
  );

  // Run the framework watcher: derive unlocks from each document transition
  // and drain the manual bus. The app loads synchronously, so it's `loaded`
  // from the first render (the watcher baselines that render, so pre-existing
  // data never backfills).
  useAchievementWatcher({
    catalog,
    state: store.data,
    unlocked: ach.unlocked,
    loaded: true,
    enabled: achievementsEnabled,
    record: ach.record,
  });

  // The sync backend and encryption flag live outside the watched document, so
  // their trophies fire through the manual bus on the state transition. The ref
  // starts false, so a fresh connection (or a restored one on boot — a capability
  // the user genuinely has) unlocks once; `record` dedupes any repeat.
  const syncedRef = useRef(false);
  useEffect(() => {
    const synced = sync.backend !== "local" && sync.connected;
    if (synced && !syncedRef.current) unlock("synced");
    syncedRef.current = synced;
  }, [sync.backend, sync.connected]);
  const encryptedRef = useRef(false);
  useEffect(() => {
    if (sync.encrypted && !encryptedRef.current) unlock("encryption");
    encryptedRef.current = sync.encrypted;
  }, [sync.encrypted]);

  // The real PWA update lifecycle, driven by the app's own service worker
  // (built by `pwa-plugin.ts`). In a deployed install this raises the prompt
  // when a freshly-deployed build reaches the `waiting` state; in dev
  // (`enabled: false`) it stays idle and registers nothing.
  const pwa = usePwaUpdate({
    base: import.meta.env.BASE_URL,
    cacheId: cacheIdForBase(import.meta.env.BASE_URL),
    enabled: !import.meta.env.DEV,
  });

  // "Open sidebar with" (Settings → General): on phones, the user picks
  // between the floating button and an inward edge swipe.
  const swipeToOpen = !pinned && settings.menuMode === "swipe";
  useEdgeSwipeOpen({
    side: position.side,
    enabled: swipeToOpen && !drawerOpen,
    onOpen: () => setDrawerOpen(true),
  });

  // Keyboard undo/redo over the same document history the side-menu buttons
  // drive (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z / Ctrl+Y). Gated off while the phone
  // drawer owns the keyboard over the screen.
  useUndoRedoShortcuts({
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    onUndo: undoWithTrophy,
    onRedo: store.redo,
    enabled: pinned || !drawerOpen,
  });

  // Publish the docked sidebar's footprint as CSS variables so viewport-fixed
  // overlays (the `UpdateToast`) centre over the content band.
  useSidebarInset(pinned, position.side);

  // Log capture follows the Developer-tab toggle.
  useEffect(() => {
    logStore.setCaptureEnabled(settings.captureLogs || settings.devMode);
  }, [settings.captureLogs, settings.devMode]);

  // Project the persisted modal-backdrop knobs (darkness / blur) onto `<html>`
  // as the CSS variables the scrim rule in `styles.css` reads. The Appearance
  // tab previews edits live off the draft; this restores the committed values.
  useEffect(() => {
    applyBackdropVars(settings);
    // Keyed on the two backdrop knobs, not the whole settings object — the rest
    // of the blob changing shouldn't re-project the backdrop variables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.modalBackdropDarkness, settings.modalBackdropBlur]);

  useEffect(() => {
    status("App started");
  }, []);

  // File away contacts whose auto-archive date has arrived (see
  // `autoArchive.ts`). Runs when the app opens and whenever a namespace switch
  // or fake-data takeover swaps in a fresh document, so a card scheduled to
  // self-archive or self-destruct while the app was closed tidies itself on the
  // next visit. The sweep is a no-op when nothing is due, so it never stacks an
  // empty undo step or loops.
  const sweepAutoArchive = store.sweepAutoArchive;
  useEffect(() => {
    sweepAutoArchive();
    // Keyed on the active document (slug + backend), not on `sweepAutoArchive`
    // itself — the callback's identity changes on every edit, and re-sweeping
    // then would be redundant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns.activeSlug, backend]);

  // The achievements trophy, seated as a row at the foot of the sidebar (or
  // nothing when achievements are switched off).
  const trophyRow = achievementsEnabled ? (
    <TrophyButton
      unseenCount={ach.unseen.length}
      showLabel
      labels={trophyLabels}
      onClick={() => {
        setDrawerOpen(false);
        if (ach.unseen.length > 0) setUnlockOpen(true);
        else setTourOpen(true);
      }}
    />
  ) : null;

  // Re-badge the browser tab. The active *namespace*'s glyph wins when it has
  // one, so a glance at the tab tells you which workspace you're in; a contact
  // with a *custom* glyph re-badges the tab with theirs. By default — the blank
  // starter card, or a contact who hasn't chosen a glyph — the tab wears the
  // app's own mark (the same person icon the installed PWA and the site's
  // static favicon show), never the framework's generic `folder` fallback.
  const active = store.activeContact;
  const activeNamespace = ns.activeNamespace;
  useEffect(() => {
    const contactHref = active?.glyph
      ? glyphDataUri(active.glyph, active.color ?? "#86efac", {
          background: "#0b0d10",
        })
      : `${import.meta.env.BASE_URL}icons/icon.svg`;
    applyFaviconHref(
      namespaceFaviconHref(activeNamespace, contactHref, {
        defaultColor: "#86efac",
        badge: { background: "#0b0d10" },
      }),
    );
  }, [active, activeNamespace]);

  return (
    <div className="flex h-[100svh] overflow-hidden bg-page-bg text-fg">
      <Sidebar
        pinned={pinned}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((v) => !v)}
        onClose={() => setDrawerOpen(false)}
        position={position}
        onPositionChange={setPosition}
        onDraggingChange={setSidebarDragging}
        // On phones the button shows only in "Floating button" mode; in
        // "Right-swipe" mode the edge-swipe gesture opens the drawer instead.
        showButton={!pinned && !swipeToOpen}
        swipeToClose
        panelScroll={false}
        labels={{
          nav: t("menu.contacts"),
          open: "Open sidebar",
          close: "Close sidebar",
        }}
      >
        <SideMenuContent
          store={screenStore}
          onDraggingChange={setSidebarDragging}
          activeNamespace={ns.activeNamespace}
          namespaces={ns.list}
          onSwitchNamespace={ns.switchTo}
          onOpenNamespaces={() => setNamespacesOpen(true)}
          onOpenSettings={() => {
            setDrawerOpen(false);
            setSettingsOpen(true);
          }}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenChangelog={() => {
            setDrawerOpen(false);
            setChangelogOpen(true);
          }}
          onNavigate={() => {
            // Selecting or creating a contact from the sidebar opens the card
            // as a full page (never the browse-page modal).
            closeContactModal();
            setView("contact");
            if (!pinned) setDrawerOpen(false);
          }}
          view={view}
          onShowArchive={() => {
            closeContactModal();
            setView("archive");
            if (!pinned) setDrawerOpen(false);
          }}
          onShowList={() => {
            closeContactModal();
            setView("list");
            if (!pinned) setDrawerOpen(false);
          }}
          onShowFavorites={() => {
            closeContactModal();
            setView("favorites");
            if (!pinned) setDrawerOpen(false);
          }}
          checkingUpdate={pwa.checking}
          updateAvailable={pwa.needRefresh}
          onCheckUpdate={pwa.checkForUpdate}
          trophy={trophyRow}
          folderSort={settings.folderSort}
        />
      </Sidebar>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Drag a `.vcf` (or CSV / JSON) onto the main area to import — the
            drop reads the cards and files them into the address book. Wraps
            both views so a drop lands whether the card or the archive shows. */}
        <ImportDropZone store={store}>
          {view === "archive" ? (
            <ArchiveScreen store={screenStore} />
          ) : view === "list" || view === "favorites" ? (
            <ContactListScreen
              store={screenStore}
              settings={settings}
              variant={view === "favorites" ? "favorites" : "all"}
              // Tapping a row floats the card up in the swipe-down modal over
              // the browse page, rather than replacing it — closing returns
              // here with the scroll position intact.
              onOpenContact={(id) => {
                store.setActive(id);
                setContactModalOpen(true);
                if (!pinned) setDrawerOpen(false);
              }}
            />
          ) : (
            <ContactScreen
              store={store}
              sync={sync}
              settings={settings}
              onOpenSyncDetails={() => setSyncDetailsOpen(true)}
              // Suppress pull-to-refresh while a sidebar drag owns the pointer,
              // and while the phone drawer covers the screen.
              pullEnabled={!sidebarDragging && (pinned || !drawerOpen)}
            />
          )}
        </ImportDropZone>
      </main>

      {/* The card as a swipe-down modal — the way in from the List / Favorites
          pages. The framework `Modal` (non-centered) carries the drag-to-
          dismiss gesture itself; pull-to-refresh is off inside it so the two
          downward gestures don't fight. Closing lands back on the browse page
          underneath. */}
      <Modal
        open={contactModalOpen && !!store.activeContact}
        onClose={closeContactModal}
        labelledBy="contact-modal-title"
        closeLabel={t("common.close")}
      >
        <h2 id="contact-modal-title" className="sr-only">
          {store.activeContact
            ? displayName(store.activeContact) || t("contact.unnamed")
            : ""}
        </h2>
        <ContactScreen
          store={store}
          sync={sync}
          settings={settings}
          onOpenSyncDetails={() => setSyncDetailsOpen(true)}
          pullEnabled={false}
          inModal
        />
      </Modal>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        appearance={appearance}
        setAppearance={setAppearance}
        settings={settings}
        commitSettings={setSettings}
        store={store}
        sync={sync}
        passwordRef={passwordRef}
      />

      {/* The connect-time replace-or-adopt prompt — opens when a freshly
          connected cloud backend already holds contacts that differ from this
          device's copy. The engine (`useSyncEngine`) owns the state and holds
          auto-save until a side is chosen. */}
      <CloudSetupModal
        pending={sync.pendingSetup}
        onResolve={sync.resolveSetup}
      />

      {/* The hovering "archived / deleted — undo?" banner — the framework's
          toast stack, rendered once here. The className override re-seats the
          viewport over the content band (not the whole viewport) via the
          sidebar-inset CSS variables, where the old app-local toast sat. */}
      <ToastViewport
        store={toastStore}
        labels={{ dismiss: t("common.close") }}
        className="pointer-events-none fixed right-[var(--app-content-right,0px)] bottom-[max(1rem,env(safe-area-inset-bottom))] left-[var(--app-content-left,0px)] z-[60] flex flex-col items-center gap-2 px-4"
      />

      {/* The framework's PWA "a new version is ready" prompt, fed from the
          real `usePwaUpdate()` state above. Once "Update" is tapped we swap the
          toast for a spinner banner so the wait for the reload reads as
          progress rather than a stuck button. */}
      {pwa.needRefresh && reloading ? (
        <div
          role="status"
          aria-live="polite"
          data-toast-stack
          className="fixed right-[calc(0.75rem+var(--app-content-right,0px))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[calc(0.75rem+var(--app-content-left,0px))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-sm border border-line bg-surface px-3 py-2.5 text-fg shadow-md"
        >
          <SpinnerIcon className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm font-medium">{t("menu.updating")}</span>
        </div>
      ) : (
        <UpdateToast
          needRefresh={pwa.needRefresh}
          incomingVersion={pwa.incomingVersion}
          onReload={() => {
            setReloading(true);
            pwa.reload();
          }}
          onDismiss={() => pwa.dismiss()}
        />
      )}

      {/* The sync command centre — opened by the card header's `SyncStatus`
          glyph. Purely presentational: the app's engine (`useSyncEngine`)
          owns the state and the actions; the framework lays them out. */}
      <SyncDetailsModal
        open={syncDetailsOpen}
        onClose={() => setSyncDetailsOpen(false)}
        providerName={sync.providerName}
        backendKind={sync.backendKind}
        location={sync.location}
        encrypted={sync.encrypted}
        status={sync.status}
        dirty={sync.dirty}
        offline={sync.offline}
        onSaveNow={sync.saveNow}
        onReload={sync.reload}
        onReconnect={sync.reconnect}
        onCheckConnection={sync.checkConnection}
        logPanel={settings.devMode ? <LogViewer store={logStore} /> : undefined}
        labels={{
          cloudSync: t("sync.cloudSync"),
          close: t("common.close"),
          status: t("sync.status"),
          backend: t("sync.backend"),
          fileLocation: t("sync.fileLocation"),
          encryptionLabel: t("sync.encryptionLabel"),
          encryptionOn: t("sync.encryptionOn"),
          encryptionOff: t("sync.encryptionOff"),
          reloadFromBackend: t("sync.reloadFromBackend"),
          saveNow: t("sync.saveNow"),
          tryAgain: t("sync.tryAgain"),
          reconnect: (name) => t("sync.reconnect", { name }),
          openIn: (name) => t("sync.openIn", { name }),
          checkConnection: t("sync.checkConnection"),
          viewSyncLog: t("sync.viewSyncLog"),
          hideSyncLog: t("sync.hideSyncLog"),
          syncingNow: t("sync.syncingNow"),
          failedHeading: t("sync.failedHeading"),
          throttledHeading: t("sync.throttledHeading"),
          throttledDetail: (name) => t("sync.throttledDetail", { name }),
          reauthHeading: t("sync.reauthHeading"),
          reauthDetail: (name) => t("sync.reauthDetail", { name }),
          conflictHeading: t("sync.conflictHeading"),
          conflictDetail: t("sync.conflictDetail"),
          pendingHeading: t("sync.pendingHeading"),
          pendingDetail: (name) => t("sync.pendingDetail", { name }),
          offlineHeading: t("sync.offlineHeading"),
          offlineDetail: (name) => t("sync.offlineDetail", { name }),
          syncedTo: (name) => t("sync.syncedTo", { name }),
          checkPinging: (name) => t("sync.checkPinging", { name }),
          checkStillOffline: (name) => t("sync.checkStillOffline", { name }),
          checkAuthExpired: (name) => t("sync.checkAuthExpired", { name }),
          failedDetailFallback: (name) =>
            t("sync.failedDetailFallback", { name }),
        }}
      />

      {/* The namespaces manager — create / switch / rename / restyle / delete
          workspaces. Presentational: the app owns the registry
          (`useNamespaces`); the framework owns the dialog. */}
      <NamespacesModal
        open={namespacesOpen}
        onClose={() => setNamespacesOpen(false)}
        namespaces={ns.list}
        activeNamespace={ns.activeSlug}
        onSwitch={ns.switchTo}
        onCreate={ns.create}
        onRename={ns.rename}
        onSetAppearance={ns.setAppearance}
        onRemove={ns.remove}
        labels={{
          heading: t("namespaces.heading"),
          blurb: t("namespaces.blurb"),
          newAction: t("namespaces.newAction"),
          namePlaceholder: t("namespaces.namePlaceholder"),
          nameLabel: t("namespaces.nameLabel"),
          create: t("namespaces.create"),
          nameRequired: t("namespaces.nameRequired"),
          colorLabel: t("namespaces.colorLabel"),
          glyphLabel: t("namespaces.glyphLabel"),
          glyphNone: t("namespaces.glyphNone"),
          save: t("namespaces.save"),
          cancel: t("namespaces.cancel"),
          renameAction: t("namespaces.renameAction"),
          deleteAction: t("namespaces.deleteAction"),
          delete: t("namespaces.delete"),
          deleteConfirm: (name) => t("namespaces.deleteConfirm", { name }),
          switchTo: (name) => t("namespaces.switchTo", { name }),
          defaultBadge: t("namespaces.defaultBadge"),
          close: t("common.close"),
        }}
      />

      {/* Full-text search over the document — the framework `SearchModal` +
          matcher, with the corpus (grouped per contact) owned by the app. */}
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        store={store}
        onNavigate={() => {
          // A search hit opens the card as a full page, like a sidebar pick.
          closeContactModal();
          setView("contact");
          if (!pinned) setDrawerOpen(false);
        }}
      />

      {/* The "What's new" dialog — opened from the side menu's About
          dropdown. The app inlines the CHANGELOG and the feature docs at
          build time (`./app/changelog.ts`). */}
      <ChangelogModal
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        releases={RELEASES}
        featureDocs={FEATURE_DOCS}
        labels={{
          heading: t("changelog.heading"),
          empty: t("changelog.empty"),
          close: t("common.close"),
          back: t("changelog.back"),
        }}
      />

      {/* The achievements tour — the full catalog, every feature a trophy. */}
      <AchievementsModal
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        achievements={catalog}
        unlocked={ach.unlocked}
        labels={achievementLabels}
      />

      {/* The unlock celebration — just the freshly-earned trophies. Closing
          it clears the unseen queue. */}
      <AchievementUnlockModal
        open={unlockOpen}
        onClose={() => {
          setUnlockOpen(false);
          ach.clearUnseen();
        }}
        achievements={catalog}
        unseenIds={ach.unseen}
        labels={unlockLabels}
      />
    </div>
  );
}
