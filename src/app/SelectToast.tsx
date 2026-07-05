// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

import {
  CheckboxGlyph,
  CloseIcon,
  CopyButton,
  FloatingPanel,
  type FloatingPlacement,
} from "@niclaslindstedt/oss-framework/components";
import { unlock } from "@niclaslindstedt/oss-framework/achievements";

import { DownloadIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { contactsToCsv, contactsToVCards } from "./export.ts";
import { downloadText, MIME_CSV, MIME_VCARD } from "./download.ts";
import type { Contact } from "./types.ts";

// The export dropdown opens above its trigger (the toast hugs the bottom of the
// screen), which the framework `FloatingPanel` flips to automatically.
const EXPORT_MENU_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 176 },
  anchor: "right",
  coordinateSpace: "viewport",
};

// The floating toolbar shown while selecting — a pill that hovers at the bottom
// of the List / Favorites page (the same shape as the import banner) rather than
// hijacking the page title. It carries the running count, a select-all toggle,
// the batch copy / export actions, and an ✕ to leave select mode. Inert export
// until something's ticked. The wrapper is click-through so the empty space
// around the pill never swallows a tap on the list beneath it.
export function SelectToast({
  count,
  allSelected,
  onToggleAll,
  onExit,
  contacts,
}: {
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onExit: () => void;
  // The selected contacts — the corpus copy / export act over.
  contacts: Contact[];
}) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const exportRef = useRef<HTMLButtonElement>(null);
  const has = count > 0;

  const runExport = (kind: "vcf" | "csv") => {
    if (kind === "vcf") {
      downloadText("contacts.vcf", contactsToVCards(contacts), MIME_VCARD);
    } else {
      downloadText("contacts.csv", contactsToCsv(contacts), MIME_CSV);
    }
    unlock("exporter");
    setMenuOpen(false);
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-1.5 text-fg-bright shadow-lg">
        <button
          type="button"
          onClick={onExit}
          aria-label={t("list.exitSelect")}
          title={t("list.exitSelect")}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        <span className="px-1 text-sm font-semibold tabular-nums whitespace-nowrap">
          {t("list.selectedCount", { n: String(count) })}
        </span>
        <span className="mx-0.5 h-6 w-px shrink-0 bg-line" aria-hidden />
        <button
          type="button"
          onClick={onToggleAll}
          role="checkbox"
          aria-checked={allSelected}
          aria-label={allSelected ? t("list.selectNone") : t("list.selectAll")}
          title={allSelected ? t("list.selectNone") : t("list.selectAll")}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-fg"
        >
          <CheckboxGlyph checked={allSelected} />
        </button>
        <CopyButton
          value={() => contactsToVCards(contacts)}
          onCopied={() => unlock("exporter")}
          labels={{ copy: t("list.copy"), copied: t("contact.copied") }}
        />
        <button
          ref={exportRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={!has}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t("list.export")}
          title={t("list.export")}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            has
              ? "cursor-pointer text-muted hover:bg-surface-3 hover:text-fg"
              : "cursor-not-allowed text-muted opacity-40"
          }`}
        >
          <DownloadIcon className="h-4 w-4" />
        </button>
        <FloatingPanel
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          triggerRef={exportRef}
          placement={EXPORT_MENU_PLACEMENT}
          className="py-1"
        >
          <div role="menu" className="flex w-full flex-col">
            <ExportMenuItem onClick={() => runExport("vcf")}>
              {t("list.exportVCard")}
            </ExportMenuItem>
            <ExportMenuItem onClick={() => runExport("csv")}>
              {t("list.exportCsv")}
            </ExportMenuItem>
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}

function ExportMenuItem({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
    >
      {children}
    </button>
  );
}
