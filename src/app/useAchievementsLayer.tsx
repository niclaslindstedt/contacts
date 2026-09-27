// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's achievements, wired together — the website's alone.
//
// The framework owns the engine, the bus and the trophy UI; the ledger is the
// app's (`./useAchievements.ts`) and so is the catalog (`./achievements.ts`).
// This hook joins them: it runs the watcher over the contacts document, fires
// the sync and encryption trophies on their transitions, and hands `App` the
// trophy row for the side-menu footer and the tour + unlock modals to mount.
//
// Nothing imports it but `./achievementsGate.ts`, which picks it only for a
// website build — so in the phone and desktop builds this module, the catalog
// and the framework's trophy UI are left out of the bundle.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  AchievementUnlockModal,
  AchievementsModal,
  TrophyButton,
  unlock,
  useAchievementWatcher,
} from "@niclaslindstedt/oss-framework/achievements";

import { buildCatalog } from "./achievements.ts";
import type { TFn } from "./i18n/index.ts";
import type { AppData } from "./types.ts";
import { useAchievements } from "./useAchievements.ts";

export type AchievementsLayer = {
  /** The trophy, as a row among the side-menu footer's — or null. */
  trophyRow: ReactNode;
  /** The tour and the unlock celebration, mounted at the app's root. */
  modals: ReactNode;
  /** Whether either of them is up (so the card's edge swipe stands down). */
  open: boolean;
};

export const NO_ACHIEVEMENTS: AchievementsLayer = {
  trophyRow: null,
  modals: null,
  open: false,
};

type Params = {
  t: TFn;
  /** The watched document. */
  data: AppData;
  /** Settings → General hasn't switched achievements off. */
  enabled: boolean;
  /** The sync backend's state, which lives outside the watched document. */
  sync: { backend: string; connected: boolean; encrypted: boolean };
  /** Called as the trophy row opens a modal (the phone drawer steps aside). */
  onOpen: () => void;
};

export function useAchievementsLayer({
  t,
  data,
  enabled,
  sync,
  onOpen,
}: Params): AchievementsLayer {
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

  // Run the framework watcher: derive unlocks from each document transition
  // and drain the manual bus. The app loads synchronously, so it's `loaded`
  // from the first render (the watcher baselines that render, so pre-existing
  // data never backfills).
  useAchievementWatcher({
    catalog,
    state: data,
    unlocked: ach.unlocked,
    loaded: true,
    enabled,
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

  // The trophy, seated as a row at the foot of the sidebar (or nothing when
  // achievements are switched off).
  const trophyRow = enabled ? (
    <TrophyButton
      unseenCount={ach.unseen.length}
      showLabel
      labels={trophyLabels}
      onClick={() => {
        onOpen();
        if (ach.unseen.length > 0) setUnlockOpen(true);
        else setTourOpen(true);
      }}
    />
  ) : null;

  const modals = (
    <>
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
    </>
  );

  return { trophyRow, modals, open: tourOpen || unlockOpen };
}
