// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useState } from "react";

import {
  ArrowDownIcon,
  Button,
  CloudUploadIcon,
  ConfirmDialog,
  DatabaseIcon,
  Modal,
  RestoreIcon,
  SpinnerIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";
import { unlock as unlockTrophy } from "@niclaslindstedt/oss-framework/achievements";

import {
  backupDisplayName,
  backupPath,
  createBackupZip,
  formatBackupDate,
  parseBackups,
  readBackupDoc,
  type BackupInfo,
} from "./backup.ts";
import { downloadBlob, MIME_ZIP } from "./download.ts";
import { useT } from "./i18n/index.ts";
import { log } from "./log.ts";
import type { ContactStore } from "./useContactStore.ts";
import type { BackupTarget } from "./useSyncEngine.ts";

// The browse-backups command centre. It opens over a connected, file-backed
// backend (a picked folder, Dropbox, or Google Drive — see `BackupTarget`) and
// paints the `backups/` folder: take a fresh snapshot, download one to disk,
// restore an older one, or prune the list. Restoring first files the current
// document as its own backup — a safety net — then adopts the chosen snapshot,
// which the sync engine then pushes back up as the live copy. The look mirrors
// the rest of the app's modals (framework `Modal` / `Button` / `ConfirmDialog`).
export function BackupsModal({
  open,
  onClose,
  store,
  target,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  store: ContactStore;
  target: BackupTarget;
  slug: string;
}) {
  const t = useT();
  // `null` while the first listing is in flight; an array (possibly empty) once
  // the backend has answered.
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A short verb describing the in-flight action, so the whole surface can go
  // inert (one backend at a time) and the acting control can show a spinner.
  const [busy, setBusy] = useState<"list" | "create" | "restore" | null>(null);
  // The path of the single row being downloaded / deleted, for its own spinner.
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupInfo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BackupInfo | null>(null);

  const failed = useCallback(
    (verb: string, err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`backup: ${verb} failed — ${message}`);
      setError(t("settings.backups.error", { message }));
    },
    [t],
  );

  const refresh = useCallback(async () => {
    setBusy("list");
    setError(null);
    try {
      const paths = await target.store.list();
      setBackups(parseBackups(paths, slug));
    } catch (err) {
      setBackups([]);
      failed("list", err);
    } finally {
      setBusy(null);
    }
  }, [target, slug, failed]);

  // Load the list whenever the modal opens; drop it on close so a re-open never
  // flashes a stale list from another backend.
  useEffect(() => {
    if (open) void refresh();
    else setBackups(null);
  }, [open, refresh]);

  const backUpNow = useCallback(async () => {
    setBusy("create");
    setError(null);
    try {
      const now = new Date();
      const zip = await createBackupZip(store.data, now);
      await target.store.write(
        backupPath(slug, store.data, now),
        zip,
        MIME_ZIP,
      );
      unlockTrophy("backup");
      log.info(`backup: wrote a snapshot (${zip.length} B)`);
      await refresh();
    } catch (err) {
      failed("create", err);
    } finally {
      setBusy(null);
    }
  }, [store, target, slug, refresh, failed]);

  const download = useCallback(
    async (info: BackupInfo) => {
      setRowBusy(info.path);
      setError(null);
      try {
        const bytes = await target.store.read(info.path);
        if (!bytes) throw new Error(t("settings.backups.gone"));
        downloadBlob(
          backupDisplayName(info),
          new Blob([bytes as BlobPart], { type: MIME_ZIP }),
        );
        log.info(`backup: downloaded ${info.path}`);
      } catch (err) {
        failed("download", err);
      } finally {
        setRowBusy(null);
      }
    },
    [target, t, failed],
  );

  const doRestore = useCallback(
    async (info: BackupInfo) => {
      setConfirmRestore(null);
      setBusy("restore");
      setError(null);
      try {
        const bytes = await target.store.read(info.path);
        if (!bytes) throw new Error(t("settings.backups.gone"));
        const text = await readBackupDoc(bytes);
        // Safety net: file the current document as its own snapshot before it is
        // replaced, so a restore is always undoable.
        const now = new Date();
        const safety = await createBackupZip(store.data, now);
        await target.store.write(
          backupPath(slug, store.data, now),
          safety,
          MIME_ZIP,
        );
        // Adopt the snapshot as the live document; the sync engine picks up the
        // version bump and pushes it back to the backend as the current copy.
        store.adoptRemote(text);
        log.info(`backup: restored ${info.path}`);
        await refresh();
      } catch (err) {
        failed("restore", err);
      } finally {
        setBusy(null);
      }
    },
    [store, target, slug, refresh, t, failed],
  );

  const doDelete = useCallback(
    async (info: BackupInfo) => {
      setConfirmDelete(null);
      setRowBusy(info.path);
      setError(null);
      try {
        await target.store.remove(info.path);
        log.info(`backup: deleted ${info.path}`);
        await refresh();
      } catch (err) {
        failed("delete", err);
      } finally {
        setRowBusy(null);
      }
    },
    [target, refresh, failed],
  );

  const inert = busy !== null || rowBusy !== null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        labelledBy="backups-title"
        closeLabel={t("common.close")}
        size="32rem"
      >
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <DatabaseIcon className="h-5 w-5 text-accent" />
              <h2
                id="backups-title"
                className="text-sm font-bold tracking-wide text-fg-bright"
              >
                {t("settings.backups.title")}
              </h2>
            </div>
            <Button
              variant="primary"
              disabled={inert}
              onClick={() => void backUpNow()}
              className="shrink-0"
            >
              <span className="flex items-center gap-1.5">
                {busy === "create" ? (
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUploadIcon className="h-4 w-4" />
                )}
                {t("settings.backups.backUpNow")}
              </span>
            </Button>
          </div>

          <p className="text-xs text-muted">
            {t("settings.backups.intro", { provider: target.provider })}
          </p>

          {error && <p className="text-sm text-danger">{error}</p>}

          {backups === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted">
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              {t("settings.backups.loading")}
            </div>
          ) : backups.length === 0 ? (
            <p className="py-6 text-sm text-muted">
              {t("settings.backups.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {backups.map((info) => (
                <li
                  key={info.path}
                  className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5"
                >
                  <div className="font-mono text-sm text-accent">
                    {backupDisplayName(info)}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {formatBackupDate(info.date)}
                      {info.contacts !== null &&
                        info.folders !== null &&
                        ` · ${t("settings.backups.counts", {
                          contacts: String(info.contacts),
                          folders: String(info.folders),
                        })}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        aria-label={t("settings.backups.download")}
                        title={t("settings.backups.download")}
                        disabled={inert}
                        onClick={() => void download(info)}
                      >
                        {rowBusy === info.path && busy === null ? (
                          <SpinnerIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowDownIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        aria-label={t("settings.backups.delete")}
                        title={t("settings.backups.delete")}
                        disabled={inert}
                        onClick={() => setConfirmDelete(info)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={inert}
                        onClick={() => setConfirmRestore(info)}
                      >
                        <span className="flex items-center gap-1.5">
                          <RestoreIcon className="h-4 w-4" />
                          {t("settings.backups.restore")}
                        </span>
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRestore !== null}
        title={t("settings.backups.restoreConfirmTitle")}
        description={t("settings.backups.restoreConfirmBody")}
        confirmLabel={t("settings.backups.restore")}
        onConfirm={() => {
          if (confirmRestore) void doRestore(confirmRestore);
        }}
        onCancel={() => setConfirmRestore(null)}
        labels={{ close: t("common.close"), cancel: t("common.cancel") }}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        tone="danger"
        title={t("settings.backups.deleteConfirmTitle")}
        description={
          confirmDelete
            ? t("settings.backups.deleteConfirmBody", {
                name: backupDisplayName(confirmDelete),
              })
            : ""
        }
        confirmLabel={t("settings.backups.delete")}
        onConfirm={() => {
          if (confirmDelete) void doDelete(confirmDelete);
        }}
        onCancel={() => setConfirmDelete(null)}
        labels={{ close: t("common.close"), cancel: t("common.cancel") }}
      />
    </>
  );
}
