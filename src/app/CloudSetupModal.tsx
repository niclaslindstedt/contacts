// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Button, Modal } from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";
import type { PendingCloudSetup } from "./useSyncEngine.ts";

// The connect-time reconcile prompt. It opens the moment a cloud backend is
// connected and the app finds it already holds contacts that differ from this
// device's copy — the two can't both silently win, so the user picks. The
// summary of each side is shown so the choice is informed ("this device: 12
// contacts" vs "Dropbox: 40 contacts"). Non-dismissable: a side has to be
// chosen before syncing resumes. Modelled on the checklist's
// `ConflictResolutionModal`, adapted to the contacts model and the connect flow.
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
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onResolve("replace")}>
            {t("cloudSetup.replace", { name: pending.provider })}
          </Button>
          <Button variant="primary" onClick={() => onResolve("cloud")}>
            {t("cloudSetup.useCloud", { name: pending.provider })}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        <h2
          id="cloud-setup-title"
          className="text-sm font-bold tracking-wide text-fg-bright"
        >
          {t("cloudSetup.title", { name: pending.provider })}
        </h2>
        <p className="text-sm text-fg">
          {t("cloudSetup.hint", { name: pending.provider })}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-line bg-surface-2 px-3 py-2">
            <div className="text-xs font-bold text-fg-bright">
              {pending.provider}
            </div>
            <div className="mt-1 text-xs text-muted">
              {counts(pending.cloud)}
            </div>
          </div>
          <div className="rounded border border-line bg-surface-2 px-3 py-2">
            <div className="text-xs font-bold text-fg-bright">
              {t("cloudSetup.thisDevice")}
            </div>
            <div className="mt-1 text-xs text-muted">
              {counts(pending.local)}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
