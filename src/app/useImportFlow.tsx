// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useState } from "react";

import { unlock } from "@niclaslindstedt/oss-framework/achievements";
import {
  Button,
  CloseIcon,
  HelpCircleIcon,
  Modal,
} from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";
import { readImportedContacts } from "./importFiles.ts";
import {
  planImport,
  type ImportConflict,
  type ImportMerge,
} from "./importMerge.ts";
import type { ImportedContact } from "./import.ts";
import type { ContactStore } from "./useContactStore.ts";

// The shared contact-import flow behind both entry points — the drag-and-drop
// overlay (`ImportDropZone`) and the Settings → Storage file picker. Reading
// the files and triaging the cards against the address book is `importFiles.ts`
// / `importMerge.ts`; this hook owns the *conversation*: obvious duplicates
// (shared phone/email) merge silently, probable ones (exact same name) queue up
// behind a confirm dialog — Merge / All (n) / Keep both — and only once every
// conflict is decided does the whole batch land in the store as one undoable
// step. The caller just renders the returned dialog and reports the result.

/** What an import run amounted to, for the caller's banner / message. */
export type ImportRunResult = {
  /** Cards filed as new contacts. */
  added: number;
  /** Cards folded into existing contacts. */
  merged: number;
  /** Cards parsed out of the files in total. Zero means nothing importable. */
  total: number;
  /** Files that were read but yielded no importable card. */
  emptyFiles: number;
};

/** The batch paused on its conflict queue, waiting for the user. */
type PendingImport = {
  conflicts: ImportConflict[];
  /** The conflict currently on screen. */
  index: number;
  additions: ImportedContact[];
  merges: ImportMerge[];
  emptyFiles: number;
  total: number;
};

/** The banner / status text for a finished import run. */
export function importResultText(
  t: ReturnType<typeof useT>,
  r: ImportRunResult,
): string {
  if (r.total === 0) return t("import.none");
  if (r.added > 0 && r.merged > 0) {
    return t("import.doneMerged", {
      added: String(r.added),
      merged: String(r.merged),
    });
  }
  if (r.merged > 0) {
    return r.merged === 1
      ? t("import.mergedOne")
      : t("import.merged", { n: String(r.merged) });
  }
  return r.added === 1
    ? t("import.doneOne")
    : t("import.done", { n: String(r.added) });
}

export function useImportFlow(
  store: ContactStore,
  onResult: (result: ImportRunResult) => void,
) {
  const t = useT();
  const [pending, setPending] = useState<PendingImport | null>(null);

  // Land the decided batch in the store (one undoable step) and report it.
  const finish = useCallback(
    (
      additions: readonly ImportedContact[],
      merges: readonly ImportMerge[],
      emptyFiles: number,
      total: number,
    ) => {
      setPending(null);
      const { added, merged } = store.applyImport({ additions, merges });
      if (added + merged > 0) unlock("importer");
      onResult({ added, merged, total, emptyFiles });
    },
    [store, onResult],
  );

  const importFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      const { contacts, emptyFiles } = await readImportedContacts(files);
      if (contacts.length === 0) {
        onResult({ added: 0, merged: 0, total: 0, emptyFiles });
        return;
      }
      const plan = planImport(store.data.contacts, contacts);
      if (plan.conflicts.length === 0) {
        finish(plan.additions, plan.merges, emptyFiles, contacts.length);
        return;
      }
      setPending({
        conflicts: plan.conflicts,
        index: 0,
        additions: plan.additions,
        merges: plan.merges,
        emptyFiles,
        total: contacts.length,
      });
    },
    [store, onResult, finish],
  );

  // Settle the on-screen conflict — merge it, merge it and every one behind
  // it, or keep both (file the draft as a new card) — and either show the next
  // conflict or land the batch.
  const resolve = useCallback(
    (action: "merge" | "mergeAll" | "keep") => {
      if (!pending) return;
      const { conflicts, index, additions, merges, emptyFiles, total } =
        pending;
      const current = conflicts[index]!;
      if (action === "mergeAll") {
        const rest = conflicts
          .slice(index)
          .map((c) => ({ targetId: c.targetId, draft: c.draft }));
        finish(additions, [...merges, ...rest], emptyFiles, total);
        return;
      }
      const nextAdditions =
        action === "keep" ? [...additions, current.draft] : additions;
      const nextMerges =
        action === "merge"
          ? [...merges, { targetId: current.targetId, draft: current.draft }]
          : merges;
      if (index + 1 < conflicts.length) {
        setPending({
          ...pending,
          index: index + 1,
          additions: nextAdditions,
          merges: nextMerges,
        });
      } else {
        finish(nextAdditions, nextMerges, emptyFiles, total);
      }
    },
    [pending, finish],
  );

  // Closing the dialog (✕ / Esc / backdrop) declines the rest of the queue:
  // the on-screen conflict and every one behind it are kept as separate cards.
  const keepRest = useCallback(() => {
    if (!pending) return;
    const { conflicts, index, additions, merges, emptyFiles, total } = pending;
    const rest = conflicts.slice(index).map((c) => c.draft);
    finish([...additions, ...rest], merges, emptyFiles, total);
  }, [pending, finish]);

  const current = pending?.conflicts[pending.index];
  const remaining = pending ? pending.conflicts.length - pending.index : 0;

  const conflictDialog = (
    <Modal
      open={pending !== null}
      onClose={keepRest}
      labelledBy="import-conflict-title"
      role="alertdialog"
      centered
      closeLabel={t("common.close")}
    >
      {/* Mirrors the framework ConfirmDialog's chrome — this dialog only
          exists app-side because it needs a third (All (n)) button. */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="import-conflict-title"
          className="flex min-w-0 items-center gap-2 text-sm font-bold tracking-wide text-fg-bright"
        >
          <span className="shrink-0 text-accent">
            <HelpCircleIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 truncate">{t("import.conflictTitle")}</span>
        </h2>
        <button
          type="button"
          onClick={keepRest}
          aria-label={t("common.close")}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>
      <div className="flex flex-col gap-4 px-4 py-4">
        {current && (
          <p className="text-sm text-muted">
            {t("import.conflictBody", {
              existing: current.targetName,
              incoming: current.draftName,
            })}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => resolve("keep")}>
            {t("import.conflictKeep")}
          </Button>
          {remaining > 1 && (
            <Button variant="secondary" onClick={() => resolve("mergeAll")}>
              {t("import.conflictMergeAll", { n: String(remaining) })}
            </Button>
          )}
          <Button variant="primary" onClick={() => resolve("merge")}>
            {t("import.conflictMerge")}
          </Button>
        </div>
      </div>
    </Modal>
  );

  return { importFiles, conflictDialog };
}
