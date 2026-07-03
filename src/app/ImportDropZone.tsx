// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState, type ReactNode } from "react";

import { unlock } from "@niclaslindstedt/oss-framework/achievements";

import { UploadIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import {
  dragHasFiles,
  filesFromDataTransfer,
  readImportedContacts,
} from "./importFiles.ts";
import { info, warn } from "../output.ts";
import type { ContactStore } from "./useContactStore.ts";

// Drag-and-drop contact import. Wraps the main content area and, whenever a
// file drag enters the window, raises a full-area overlay inviting the drop.
// Dropping a `.vcf` (the format iOS/Android/Outlook Contacts hand out), the
// app's own JSON backup, or an Outlook CSV parses the cards and files them into
// the address book (see `import.ts` / `useContactStore.importContacts`). A
// short banner reports how many contacts landed.
//
// The overlay is driven by an enter/leave counter: `dragenter` and `dragleave`
// fire for every child element the pointer crosses, so a bare boolean would
// flicker. Counting keeps the overlay up until the drag truly leaves.

type Banner = { kind: "ok" | "empty"; text: string };

export function ImportDropZone({
  store,
  children,
}: {
  store: ContactStore;
  children: ReactNode;
}) {
  const t = useT();
  const [dragging, setDragging] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const depth = useRef(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((next: Banner) => {
    setBanner(next);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  const runImport = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const { contacts, emptyFiles } = await readImportedContacts(files);
      if (contacts.length === 0) {
        warn(`import: no contacts found in ${files.length} file(s)`);
        showBanner({ kind: "empty", text: t("import.none") });
        return;
      }
      const n = store.importContacts(contacts);
      info(`import: filed ${n} contact(s) from ${files.length} file(s)`);
      if (n > 0) unlock("importer");
      showBanner({
        kind: "ok",
        text:
          n === 1 ? t("import.doneOne") : t("import.done", { n: String(n) }),
      });
      if (emptyFiles > 0) {
        warn(`import: ${emptyFiles} file(s) had no importable contacts`);
      }
    },
    [store, showBanner, t],
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    depth.current += 1;
    setDragging(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e.dataTransfer)) return;
    // Signal we accept the drop (without this, the browser opens the file).
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e.dataTransfer)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!dragHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      void runImport(filesFromDataTransfer(e.dataTransfer));
    },
    [runImport],
  );

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}

      {dragging && (
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
