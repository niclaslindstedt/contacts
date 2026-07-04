// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  CloudAlertIcon,
  Modal,
} from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";
import type { PendingCloudSetup } from "./useSyncEngine.ts";

// The connect-time reconcile prompt. It opens the moment a cloud backend is
// connected and the app finds it already holds contacts that differ from this
// device's copy — the two can't both silently win, so the user picks. Each
// side's summary rides inside its own choice button ("Dropbox — 34 contacts ·
// 6 folders" vs "This device — 1 contact · 0 folders") so the count that
// informs the decision sits right on the button that acts on it.
// Non-dismissable: a side has to be chosen before syncing resumes. Modelled on
// the checklist's `ConflictResolutionModal`, adapted to the contacts model and
// the connect flow.
export function CloudSetupModal({
  pending,
  onResolve,
}: {
  pending: PendingCloudSetup | null;
  onResolve: (choice: "cloud" | "replace") => void;
}) {
  const t = useT();
  if (!pending) return null;

  const counts = (n: { contacts: number; folders: number }) =>
    t("cloudSetup.counts", {
      contacts: String(n.contacts),
      folders: String(n.folders),
    });

  return (
    <Modal
      open
      // Non-dismissable: the two copies can't coexist, so the user has to pick a
      // side. Backdrop click and Escape are no-ops.
      onClose={() => {}}
      labelledBy="cloud-setup-title"
      role="alertdialog"
      centered
      size="max-w-sm"
    >
      <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-7 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
          <CloudAlertIcon className="h-6 w-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2
            id="cloud-setup-title"
            className="text-base font-bold text-fg-bright"
          >
            {t("cloudSetup.title", { name: pending.provider })}
          </h2>
          <p className="text-sm leading-snug text-muted">
            {t("cloudSetup.hint", { name: pending.provider })}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5">
          <ChoiceButton
            label={t("cloudSetup.useCloud", { name: pending.provider })}
            detail={counts(pending.cloud)}
            onClick={() => onResolve("cloud")}
            primary
          />
          <ChoiceButton
            label={t("cloudSetup.replace", { name: pending.provider })}
            detail={counts(pending.local)}
            onClick={() => onResolve("replace")}
          />
        </div>
      </div>
    </Modal>
  );
}

// One full-width choice. The primary side is the safe default (keep the cloud
// copy that already exists); the other overwrites it with this device.
function ChoiceButton({
  label,
  detail,
  onClick,
  primary = false,
}: {
  label: string;
  detail: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full flex-col items-center gap-0.5 rounded-lg border px-4 py-3 text-center transition-colors " +
        (primary
          ? "border-accent bg-accent/15 text-accent hover:bg-accent hover:text-surface"
          : "border-line bg-surface-2 text-fg hover:border-muted hover:bg-surface-3")
      }
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="text-xs opacity-80">{detail}</span>
    </button>
  );
}
