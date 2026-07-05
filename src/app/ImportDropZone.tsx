// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState, type ReactNode } from "react";

import { UploadIcon } from "@niclaslindstedt/oss-framework/components";
import { useFileDrop } from "@niclaslindstedt/oss-framework/hooks";

import { useT } from "./i18n/index.ts";
import {
  importResultText,
  useImportFlow,
  type ImportRunResult,
} from "./useImportFlow.tsx";
import { info, warn } from "../output.ts";
import type { ContactStore } from "./useContactStore.ts";

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

type Banner = { kind: "ok" | "empty"; text: string };

export function ImportDropZone({
  store,
  children,
}: {
  store: ContactStore;
  children: ReactNode;
}) {
  const t = useT();
  const [banner, setBanner] = useState<Banner | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((next: Banner) => {
    setBanner(next);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  const onResult = useCallback(
    (r: ImportRunResult) => {
      if (r.total === 0) {
        warn("import: no contacts found in the dropped file(s)");
        showBanner({ kind: "empty", text: t("import.none") });
        return;
      }
      info(
        `import: filed ${r.added} new contact(s), merged ${r.merged} into existing`,
      );
      showBanner({ kind: "ok", text: importResultText(t, r) });
      if (r.emptyFiles > 0) {
        warn(`import: ${r.emptyFiles} file(s) had no importable contacts`);
      }
    },
    [showBanner, t],
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

      {banner && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg ${
              banner.kind === "ok"
                ? "border-accent bg-surface-2 text-fg-bright"
                : "border-line bg-surface-2 text-muted"
            }`}
          >
            <UploadIcon className="h-4 w-4 shrink-0 text-accent" />
            <span>{banner.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
