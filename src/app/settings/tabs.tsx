// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import {
  Button,
  SegmentedControl,
  Section,
  SelectPicker,
  ToggleRow,
  UnlockGate,
} from "@niclaslindstedt/oss-framework/components";
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";
import { useStandaloneMobile } from "@niclaslindstedt/oss-framework/pwa";
import { unlock as unlockTrophy } from "@niclaslindstedt/oss-framework/achievements";

import { log, logStore } from "../log.ts";
import { useT } from "../i18n/index.ts";
import { contactsToCsv, contactsToVCards } from "../export.ts";
import { serializeDoc } from "../migrations.ts";
import { downloadText, MIME_CSV, MIME_JSON, MIME_VCARD } from "../download.ts";
import {
  DATE_FORMATS,
  PHONE_FORMATS,
  ZIP_FORMATS,
  formatDate,
  formatPhoneValue,
  formatZip,
  type DateFormat,
  type PhoneFormat,
  type ZipFormat,
} from "../format.ts";
import type { AppSettings } from "../useAppSettings.ts";
import type { ContactStore } from "../useContactStore.ts";
import {
  DROPBOX_APP_KEY,
  GOOGLE_CLIENT_ID,
  PROVIDER_NAMES,
  type MutablePasswordRef,
  type SyncEngine,
} from "../useSyncEngine.ts";
import { LanguagePicker } from "./shared.tsx";

type Update = <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
) => void;

// --- General ---------------------------------------------------------------

export function GeneralTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
  const t = useT();
  const modeOptions = [
    { value: "swipe" as const, label: t("settings.general.optionSwipe") },
    { value: "button" as const, label: t("settings.general.optionButton") },
  ];
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.general.intro")}</p>

      <Section title={t("settings.general.languageTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.general.chooseLanguage")}
          </span>
          <LanguagePicker />
          <p className="text-xs text-muted">
            {t("settings.general.languageHint")}
          </p>
        </div>
      </Section>

      <Section title={t("settings.general.achievementsTitle")}>
        <ToggleRow
          label={t("settings.general.disableAchievements")}
          hint={t("settings.general.disableAchievementsHint")}
          checked={settings.disableAchievements}
          onChange={(next) => update("disableAchievements", next)}
        />
      </Section>

      <Section title={t("settings.general.sidebarTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.general.openSidebarWith")}
          </span>
          <SegmentedControl
            value={settings.menuMode}
            options={modeOptions}
            onChange={(next) => update("menuMode", next)}
            ariaLabel={t("settings.general.openSidebarWith")}
          />
          <p className="text-xs text-muted">
            {t("settings.general.sidebarHint")}
          </p>
        </div>
      </Section>

      <Section title={t("settings.general.developerTitle")}>
        <ToggleRow
          label={t("settings.general.developerMode")}
          hint={t("settings.general.developerModeHint")}
          checked={settings.devMode}
          onChange={(next) => update("devMode", next)}
        />
      </Section>
    </div>
  );
}

// --- Format ----------------------------------------------------------------

// Representative samples the pickers preview each style with. The phone sample
// carries an explicit country code so the international / national styles read
// differently; the zip sample carries the extra digits ZIP+4 needs.
const SAMPLE_DATE = "2026-07-03";
const SAMPLE_PHONE = "+46812345678";
const SAMPLE_ZIP = "12345-6789";

// Display styles for the value-shaped fields — dates, phone numbers, postal
// codes. Each picker previews every option with a live sample (its `hint`) and
// echoes the current pick beneath. These are staged like the other draft
// settings and only bite on Save.
export function FormatTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
  const t = useT();

  const dateOptions = DATE_FORMATS.map((value) => ({
    value,
    label: t(`settings.format.date.${value}`),
    hint: formatDate(SAMPLE_DATE, value),
  }));
  const phoneOptions = PHONE_FORMATS.map((value) => ({
    value,
    label: t(`settings.format.phone.${value}`),
    hint: formatPhoneValue(SAMPLE_PHONE, value),
  }));
  const zipOptions = ZIP_FORMATS.map((value) => ({
    value,
    label: t(`settings.format.zip.${value}`),
    hint: formatZip(SAMPLE_ZIP, value),
  }));

  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.format.intro")}</p>

      <Section title={t("settings.format.dateTitle")}>
        <FormatField
          preview={formatDate(SAMPLE_DATE, settings.dateFormat)}
          hint={t("settings.format.dateHint")}
        >
          <SelectPicker<DateFormat>
            value={settings.dateFormat}
            options={dateOptions}
            onChange={(next) => update("dateFormat", next)}
            ariaLabel={t("settings.format.dateTitle")}
          />
        </FormatField>
      </Section>

      <Section title={t("settings.format.phoneTitle")}>
        <FormatField
          preview={formatPhoneValue(SAMPLE_PHONE, settings.phoneFormat)}
          hint={t("settings.format.phoneHint")}
        >
          <SelectPicker<PhoneFormat>
            value={settings.phoneFormat}
            options={phoneOptions}
            onChange={(next) => update("phoneFormat", next)}
            ariaLabel={t("settings.format.phoneTitle")}
          />
        </FormatField>
      </Section>

      <Section title={t("settings.format.zipTitle")}>
        <FormatField
          preview={formatZip(SAMPLE_ZIP, settings.zipFormat)}
          hint={t("settings.format.zipHint")}
        >
          <SelectPicker<ZipFormat>
            value={settings.zipFormat}
            options={zipOptions}
            onChange={(next) => update("zipFormat", next)}
            ariaLabel={t("settings.format.zipTitle")}
          />
        </FormatField>
      </Section>
    </div>
  );
}

// The picker + a live "Sample: …" line + the explanatory hint, laid out the
// same way for all three format rows.
function FormatField({
  preview,
  hint,
  children,
}: {
  preview: string;
  hint: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      {children}
      <p className="text-xs text-muted">
        {t("settings.format.previewLabel")}{" "}
        <span className="font-mono text-fg">{preview}</span>
      </p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

// --- Storage ------------------------------------------------------------------

const inputClass =
  "rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-sm text-fg outline-none focus:border-accent";

// Where the document lives (the real sync engine's backend picker), the
// at-rest encryption of the cloud copy, and the export surface. All of these
// apply live — they are device/backend state, not staged draft settings.
export function StorageTab({
  store,
  sync,
  passwordRef,
}: {
  store: ContactStore;
  sync: SyncEngine;
  passwordRef: MutablePasswordRef;
}) {
  const t = useT();
  const [pass, setPass] = useState("");
  const [gateOpen, setGateOpen] = useState(false);

  const backendOptions = [
    { value: "local" as const, label: t("settings.storage.backendThisDevice") },
    { value: "dropbox" as const, label: t("settings.storage.backendDropbox") },
    { value: "gdrive" as const, label: t("settings.storage.backendGdrive") },
  ];

  // The picker shows the *target* backend; an unconnected cloud pick shows its
  // Connect affordance until the OAuth flow lands.
  const [picked, setPicked] = useState(sync.backend);
  const pickedCloud = picked !== "local" ? picked : null;
  const missingKey =
    (pickedCloud === "dropbox" && !DROPBOX_APP_KEY) ||
    (pickedCloud === "gdrive" && !GOOGLE_CLIENT_ID);

  const exportable = store.data.contacts.filter(
    (c) => c.firstName || c.lastName || c.company || c.phones.length > 0,
  );
  const runExport = (kind: "vcf" | "csv" | "json") => {
    if (kind === "vcf") {
      downloadText("contacts.vcf", contactsToVCards(exportable), MIME_VCARD);
    } else if (kind === "csv") {
      downloadText("contacts.csv", contactsToCsv(exportable), MIME_CSV);
    } else {
      downloadText("contacts.json", serializeDoc(store.data), MIME_JSON);
    }
    unlockTrophy("exporter");
    log.info(`export: downloaded contacts.${kind}`);
  };

  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.storage.intro")}</p>

      <Section title={t("settings.storage.backendTitle")}>
        <SegmentedControl
          value={picked}
          onChange={(next) => {
            setPicked(next);
            if (next === "local" && sync.backend !== "local") sync.disconnect();
          }}
          options={backendOptions}
          ariaLabel={t("settings.storage.backendTitle")}
        />
        {pickedCloud && missingKey && (
          <p className="text-xs text-warning">
            {pickedCloud === "dropbox"
              ? t("settings.storage.missingKeyDropbox")
              : t("settings.storage.missingKeyGdrive")}
          </p>
        )}
        {pickedCloud && !missingKey && (
          <div className="flex flex-wrap items-center gap-2">
            {sync.backend === pickedCloud && sync.connected ? (
              <>
                <span className="text-sm text-success">
                  {t("settings.storage.connectedAs", {
                    name: PROVIDER_NAMES[pickedCloud],
                  })}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => {
                    sync.disconnect();
                    setPicked("local");
                  }}
                >
                  {t("settings.storage.disconnect")}
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onClick={() =>
                  void (pickedCloud === "dropbox"
                    ? sync.connectDropbox()
                    : sync.connectGdrive())
                }
              >
                {t("settings.storage.connect", {
                  name: PROVIDER_NAMES[pickedCloud],
                })}
              </Button>
            )}
          </div>
        )}
      </Section>

      <Section title={t("settings.storage.encryptionTitle")}>
        <ToggleRow
          label={t("settings.storage.encryptCloud")}
          hint={t("settings.storage.encryptCloudHint")}
          checked={sync.encrypted}
          onChange={(next) => {
            if (!next) {
              sync.setEncrypted(false);
              passwordRef.current = null;
              sync.saveNow();
            } else if (passwordRef.current) {
              sync.setEncrypted(true);
              sync.saveNow();
            }
            // Turning on without a passphrase in memory: the input below
            // collects one first; `setEncrypted` fires on "Set passphrase".
          }}
        />
        {!sync.encrypted && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={t("settings.storage.passphrase")}
              className={inputClass}
            />
            <Button
              variant="primary"
              disabled={!pass}
              onClick={() => {
                passwordRef.current = pass;
                setPass("");
                sync.setEncrypted(true);
                sync.saveNow();
              }}
            >
              {t("settings.storage.encrypt")}
            </Button>
          </div>
        )}
        {sync.encrypted && !sync.locked && (
          <span className="text-sm text-success">
            {t("settings.storage.encryptedUnlocked")}
          </span>
        )}
        {sync.locked && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted">
              {t("settings.storage.lockedNotice")}
            </span>
            <Button
              variant="primary"
              className="self-start"
              onClick={() => setGateOpen(true)}
            >
              {t("settings.storage.unlock")}
            </Button>
          </div>
        )}
      </Section>

      <Section title={t("settings.storage.exportTitle")}>
        <p className="text-xs text-muted">
          {t("settings.storage.exportIntro")}
        </p>
        {exportable.length === 0 ? (
          <p className="text-xs text-muted">
            {t("settings.storage.exportEmpty")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => runExport("vcf")}>
              {t("settings.storage.exportVCard")}
            </Button>
            <Button variant="secondary" onClick={() => runExport("csv")}>
              {t("settings.storage.exportCsv")}
            </Button>
            <Button variant="secondary" onClick={() => runExport("json")}>
              {t("settings.storage.exportJson")}
            </Button>
          </div>
        )}
      </Section>

      {/* The framework's full-screen lock screen — the cloud copy is an
          envelope and the session passphrase is gone after a reload. A wrong
          passphrase routes through `mapError` to a friendly message. */}
      <UnlockGate
        open={gateOpen && sync.locked}
        onUnlock={async (password, onProgress) => {
          onProgress(t("settings.storage.gateDeriving"));
          await sync.unlock(password);
          setGateOpen(false);
        }}
        mapError={() => t("settings.storage.gateWrong")}
        labels={{
          title: t("settings.storage.gateTitle"),
          hint: t("settings.storage.gateHint"),
          passphrase: t("settings.storage.passphrase"),
          unlock: t("settings.storage.unlock"),
          statusAria: t("settings.storage.gateStatusAria"),
          clear: t("common.clear"),
        }}
      />
    </div>
  );
}

// --- Developer -------------------------------------------------------------

export function DeveloperTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
  const t = useT();
  // Real install context, read from the framework's PWA detection. `true`
  // only inside an installed PWA window on a phone/tablet.
  const standalone = useStandaloneMobile();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.developer.intro")}</p>
      <Section title={t("settings.developer.loggingTitle")}>
        <ToggleRow
          label={t("settings.developer.captureLogs")}
          hint={t("settings.developer.captureLogsHint")}
          checked={settings.captureLogs}
          onChange={(next) => update("captureLogs", next)}
        />
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => log.info("Test log line from the Developer tab")}
        >
          {t("settings.developer.writeTestLine")}
        </Button>
      </Section>
      <Section title={t("settings.developer.buildTitle")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">app</dt>
          <dd className="text-fg tabular-nums">contacts v{__APP_VERSION__}</dd>
          <dt className="text-muted">{t("settings.developer.buildLabel")}</dt>
          <dd className="text-fg tabular-nums">{__BUILD_NUMBER__}</dd>
          <dt className="text-muted">{t("settings.developer.commitLabel")}</dt>
          <dd className="text-fg tabular-nums">{__BUILD_COMMIT__}</dd>
          <dt className="text-muted">{t("settings.developer.modeLabel")}</dt>
          <dd className="text-fg">{import.meta.env.MODE}</dd>
          <dt className="text-muted">{t("settings.developer.displayLabel")}</dt>
          <dd className="text-fg">
            {standalone
              ? t("settings.developer.installedPwa")
              : t("settings.developer.browserTab")}
          </dd>
        </dl>
      </Section>
    </div>
  );
}

// --- Logs ------------------------------------------------------------------

export function LogsTab() {
  const t = useT();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.logs.intro")}</p>
      <Section title={t("settings.logs.logsTitle")}>
        <LogViewer store={logStore} />
      </Section>
    </div>
  );
}
