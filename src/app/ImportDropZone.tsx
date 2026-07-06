// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, type ReactNode } from "react";

import { UploadIcon } from "@niclaslindstedt/oss-framework/components";
import { useFileDrop } from "@niclaslindstedt/oss-framework/hooks";

import { useT } from "./i18n/index.ts";
import {
  importResultText,
  useImportFlow,
  type ImportRunResult,
} from "./useImportFlow.tsx";
import { INFO_TOAST_MS, toastStore } from "./toast.ts";
import { info, warn } from "../output.ts";
import type { ContactStore } from "./useContactStore.ts";

const importGlyph = <UploadIcon className="h-4 w-4" />;

// Drag-and-drop contact import. Wraps the main content area and, whenever a
// file drag enters it, raises a full-area overlay inviting the drop. Dropping
// a `.vcf` (the format iOS/Android/Outlook Contacts hand out), the app's own
// JSON backup, or an Outlook CSV parses the cards and files them into the
// address book — merging obvious duplicates and confirming probable ones (see
// `useImportFlow` / `importMerge.ts`). A short banner reports how many
// contacts landed and how many merged.
//
// The framework's `useFileDrop` owns the drag mechanics — including the
// enter/leave depth counting that keeps the overlay from flickering as the
// pointer crosses child elements. The nested `ContactPhotoDropZone` claims
// image drags away from this zone, so only importable files raise it.
//
// The result lands on the app's shared toast (`toastStore`) — the same hovering
// pill archive / delete / favorite use — so every confirmation reads the same.

export function ImportDropZone({
  store,
  children,
}: {
  store: ContactStore;
  children: ReactNode;
}) {
  const t = useT();
  const zoneRef = useRef<HTMLDivElement>(null);

  const onResult = useCallback(
    (r: ImportRunResult) => {
      // One banner at a time — clear any lingering undo toast first.
      toastStore.clear();
      if (r.total === 0) {
        warn("import: no contacts found in the dropped file(s)");
        toastStore.push({
          message: t("import.none"),
          icon: importGlyph,
          durationMs: INFO_TOAST_MS,
        });
        return;
      }
      info(
        `import: filed ${r.added} new contact(s), merged ${r.merged} into existing`,
      );
      toastStore.push({
        message: importResultText(t, r),
        icon: importGlyph,
        durationMs: INFO_TOAST_MS,
      });
      if (r.emptyFiles > 0) {
        warn(`import: ${r.emptyFiles} file(s) had no importable contacts`);
      }
    },
    [t],
  );
  const { importFiles, conflictDialog } = useImportFlow(store, onResult);

  const { active } = useFileDrop({
    targetRef: zoneRef,
    onDrop: (files) => void importFiles(files),
  });

  return (
    <div ref={zoneRef} className="relative flex min-h-0 flex-1 flex-col">
      {children}

      {active && (
        <div
          className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-page-bg/85 text-center backdrop-blur-sm"
          aria-hidden
        >
          <UploadIcon className="h-10 w-10 text-accent" />
          <div className="px-6">
            <p className="text-base font-semibold text-fg-bright">
              {t("import.dropTitle")}
            </p>
            <p className="mt-1 text-sm text-muted">{t("import.dropHint")}</p>
          </div>
        </div>
      )}

      {conflictDialog}
    </div>
  );
}
