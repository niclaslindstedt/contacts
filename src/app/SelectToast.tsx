// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

import {
  CopyButton,
  CopyIcon,
  FloatingPanel,
  type FloatingPlacement,
} from "@niclaslindstedt/oss-framework/components";
import { unlock } from "@niclaslindstedt/oss-framework/achievements";

import { DownloadIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { contactsToCsv, contactsToVCards } from "./export.ts";
import { downloadText, MIME_CSV, MIME_VCARD } from "./download.ts";
import type { Contact } from "./types.ts";

// The export dropdown hangs off the download button in the List header, so it
// opens below its trigger — the framework `FloatingPanel` places it there and
// flips it up automatically when there isn't room below.
const EXPORT_MENU_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 176 },
  anchor: "right",
  coordinateSpace: "viewport",
};

// The batch copy / export actions that live in the List header's top menu while
// selecting — a copy-as-vCard button and a download button that opens the
// vCard / CSV export menu. Both act over the ticked selection; both stay inert
// until at least one card is ticked. The buttons are sized to match the
// header's other glyph buttons (`h-9 w-9`, bordered) so the row reads as one
// toolbar.
export function SelectActions({ contacts }: { contacts: Contact[] }) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const exportRef = useRef<HTMLButtonElement>(null);
  const has = contacts.length > 0;

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
    <>
      {has ? (
        <CopyButton
          value={() => contactsToVCards(contacts)}
          onCopied={() => unlock("exporter")}
          labels={{ copy: t("list.copy"), copied: t("contact.copied") }}
        />
      ) : (
        <button
          type="button"
          disabled
          aria-label={t("list.copy")}
          title={t("list.copy")}
          className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-line bg-transparent text-muted opacity-40"
        >
          <CopyIcon className="h-4 w-4" />
        </button>
      )}
      <button
        ref={exportRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={!has}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t("list.export")}
        title={t("list.export")}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
          has
            ? "cursor-pointer border-line text-muted hover:bg-surface-2 hover:text-fg"
            : "cursor-not-allowed border-line text-muted opacity-40"
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
    </>
  );
}

// The running count while selecting — a small pill that hovers at the bottom of
// the List / Favorites page so the tally stays in view as you scroll and tick
// cards. The batch actions and the select-all toggle have moved to the header
// and the top of the list; this bar carries the count alone. The wrapper is
// click-through so the empty space around the pill never swallows a tap on the
// list beneath it.
export function SelectCountBar({ count }: { count: number }) {
  const t = useT();
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex max-w-full items-center rounded-full border border-line bg-surface-2 px-4 py-1.5 text-fg-bright shadow-lg">
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
          {t("list.selectedCount", { n: String(count) })}
        </span>
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
