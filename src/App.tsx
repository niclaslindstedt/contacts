// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef, useState } from "react";

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
import { CATALOG } from "./app/achievements.ts";
import { useT } from "./app/i18n/index.ts";
import { APP_LOOK } from "./app/look.ts";
import { logStore } from "./app/log.ts";
import { status } from "./output.ts";
import { useAchievements } from "./app/useAchievements.ts";
import { useAppSettings } from "./app/useAppSettings.ts";
import { useDevSeed } from "./app/dev/useDevSeed.ts";
import { createSeedBackend } from "./app/dev/seedBackend.ts";
import { localDocBackend, useContactStore } from "./app/useContactStore.ts";
import { useNamespaces } from "./app/useNamespaces.ts";
import { useSyncEngine } from "./app/useSyncEngine.ts";
import { cacheIdForBase } from "./app/pwa.ts";

// A local-first contacts PWA built from the framework's shared surface. The
// framework `Sidebar` frames the navigation (docked on wide screens, a
// draggable drawer on phones); the app owns the contact store, the card
// screen, the side-menu content, the real sync engine, and its tabbed
// Settings dialog.
export function App() {
  const t = useT();
  const [appearance, setAppearance] = useState<ThemeAppearance>(APP_LOOK);
  useApplyTheme(appearance);

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
  // side menu's action grid).
  const [view, setView] = useState<
    "contact" | "archive" | "list" | "favorites"
  >("contact");
  // Which browse page the current card was opened from, so its header offers a
  // back button to that exact page. `null` for any other way into a card (a
  // sidebar pick, a search hit, a fresh contact).
  const [openedFrom, setOpenedFrom] = useState<"list" | "favorites" | null>(
    null,
  );
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

  // Undo lives outside the document state, so its trophy fires through the
  // manual bus rather than a derived predicate.
  const undoWithTrophy = () => {
    store.undo();
    unlock("timeTraveler");
  };

  // Run the framework watcher: derive unlocks from each document transition
  // and drain the manual bus. The app loads synchronously, so it's `loaded`
  // from the first render (the watcher baselines that render, so pre-existing
  // data never backfills).
  useAchievementWatcher({
    catalog: CATALOG,
    state: store.data,
    unlocked: ach.unlocked,
    loaded: true,
    enabled: achievementsEnabled,
    record: ach.record,
  });

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
          store={{ ...store, undo: undoWithTrophy }}
          pinned={pinned}
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
            // Selecting or creating a contact always lands on the card view —
            // not via a browse page, so no back button.
            setOpenedFrom(null);
            setView("contact");
            if (!pinned) setDrawerOpen(false);
          }}
          view={view}
          onShowArchive={() => {
            setView("archive");
            if (!pinned) setDrawerOpen(false);
          }}
          onShowList={() => {
            setView("list");
            if (!pinned) setDrawerOpen(false);
          }}
          onShowFavorites={() => {
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
            <ArchiveScreen store={store} />
          ) : view === "list" || view === "favorites" ? (
            <ContactListScreen
              store={store}
              settings={settings}
              variant={view === "favorites" ? "favorites" : "all"}
              onOpenContact={(id) => {
                store.setActive(id);
                setOpenedFrom(view === "favorites" ? "favorites" : "list");
                setView("contact");
                if (!pinned) setDrawerOpen(false);
              }}
            />
          ) : (
            <ContactScreen
              store={store}
              sync={sync}
              settings={settings}
              onOpenSyncDetails={() => setSyncDetailsOpen(true)}
              // A card opened from a browse page carries a back button to it.
              onBack={openedFrom ? () => setView(openedFrom) : undefined}
              // Suppress pull-to-refresh while a sidebar drag owns the pointer,
              // and while the phone drawer covers the screen.
              pullEnabled={!sidebarDragging && (pinned || !drawerOpen)}
            />
          )}
        </ImportDropZone>
      </main>

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

      {/* The framework's PWA "a new version is ready" prompt, fed from the
          real `usePwaUpdate()` state above. */}
      <UpdateToast
        needRefresh={pwa.needRefresh}
        incomingVersion={pwa.incomingVersion}
        onReload={() => pwa.reload()}
        onDismiss={() => pwa.dismiss()}
      />

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
          setOpenedFrom(null);
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
        achievements={CATALOG}
        unlocked={ach.unlocked}
      />

      {/* The unlock celebration — just the freshly-earned trophies. Closing
          it clears the unseen queue. */}
      <AchievementUnlockModal
        open={unlockOpen}
        onClose={() => {
          setUnlockOpen(false);
          ach.clearUnseen();
        }}
        achievements={CATALOG}
        unseenIds={ach.unseen}
      />
    </div>
  );
}
