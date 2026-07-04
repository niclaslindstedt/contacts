// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

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
import { useDevSeed } from "../dev/useDevSeed.ts";
import { useT } from "../i18n/index.ts";
import { contactsToCsv, contactsToVCards } from "../export.ts";
import { IMPORT_ACCEPT, readImportedContacts } from "../importFiles.ts";
import { serializeDoc } from "../migrations.ts";
import { downloadText, MIME_CSV, MIME_JSON, MIME_VCARD } from "../download.ts";
import { DATE_FORMATS, formatDate, type DateFormat } from "../format.ts";
import {
  COUNTRIES,
  formatPhoneValue,
  formatPostalValue,
  getCountry,
  type CountryCode,
} from "../countries/index.ts";
import {
  phoneOptions,
  postalOptions,
  type AppSettings,
  type FolderSort,
  type ListDensity,
  type ListPhonePriority,
} from "../useAppSettings.ts";
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
  const folderSortOptions = [
    {
      value: "alphabetical" as const,
      label: t("settings.general.folderSortAlphabetical"),
    },
    {
      value: "manual" as const,
      label: t("settings.general.folderSortManual"),
    },
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

      <Section title={t("settings.general.foldersTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.general.folderSortLabel")}
          </span>
          <SegmentedControl<FolderSort>
            value={settings.folderSort}
            options={folderSortOptions}
            onChange={(next) => update("folderSort", next)}
            ariaLabel={t("settings.general.folderSortLabel")}
          />
          <p className="text-xs text-muted">
            {t("settings.general.folderSortHint")}
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

// --- List ------------------------------------------------------------------

// The overview List page's display knobs: whether each row shows the contact's
// phone numbers and / or emails under their name. Staged like the other draft
// settings and only committed on Save.
export function ListTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
  const t = useT();
  const densityOptions = [
    { value: "compact" as const, label: t("settings.list.densityCompact") },
    { value: "spacious" as const, label: t("settings.list.densitySpacious") },
  ];
  const priorityOptions = [
    { value: "private" as const, label: t("contact.kindPrivate") },
    { value: "work" as const, label: t("contact.kindWork") },
    { value: "both" as const, label: t("settings.list.priorityBoth") },
  ];
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.list.intro")}</p>
      <Section title={t("settings.list.densityTitle")}>
        <div className="flex flex-col gap-1">
          <SegmentedControl<ListDensity>
            value={settings.listDensity}
            options={densityOptions}
            onChange={(next) => update("listDensity", next)}
            ariaLabel={t("settings.list.densityTitle")}
          />
          <p className="text-xs text-muted">{t("settings.list.densityHint")}</p>
        </div>
      </Section>
      <Section title={t("settings.list.contactMethodsTitle")}>
        <ToggleRow
          label={t("settings.list.showPhone")}
          hint={t("settings.list.showPhoneHint")}
          checked={settings.listShowPhone}
          onChange={(next) => update("listShowPhone", next)}
        />
        <NestedOptions enabled={settings.listShowPhone}>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-fg-bright">
              {t("settings.list.priorityTitle")}
            </span>
            <SegmentedControl<ListPhonePriority>
              value={settings.listPhonePriority}
              options={priorityOptions}
              onChange={(next) => update("listPhonePriority", next)}
              fullWidth
              ariaLabel={t("settings.list.priorityTitle")}
            />
            <p className="text-xs text-muted">
              {t("settings.list.priorityHint")}
            </p>
          </div>
        </NestedOptions>
        <ToggleRow
          label={t("settings.list.showEmail")}
          hint={t("settings.list.showEmailHint")}
          checked={settings.listShowEmail}
          onChange={(next) => update("listShowEmail", next)}
        />
      </Section>
    </div>
  );
}

// --- Format ----------------------------------------------------------------

const SAMPLE_DATE = "2026-07-03";

// Formatting is country-based: the user picks a home country and the country
// decides how phones and postal codes are shaped (see `countries/`). The tab
// exposes a small set of country-agnostic toggles — format at all, show the
// country code, the leading zero, group with spaces — and previews them live
// against that country's own sample number. The date format stays an
// independent style pick. All of this is staged like the other draft settings
// and only bites on Save.
export function FormatTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
  const t = useT();
  const country = getCountry(settings.country);

  const countryOptions = COUNTRIES.map((c) => ({
    value: c.code as CountryCode,
    // The country name key is data-driven (one per registered country), so it
    // can't be a statically-known catalog leaf — narrow it at the call site.
    label: `${c.flag} ${t(
      `settings.format.country.${c.nameKey}` as Parameters<typeof t>[0],
    )}`,
  }));
  const dateOptions = DATE_FORMATS.map((value) => ({
    value,
    label: t(`settings.format.date.${value}`),
    hint: formatDate(SAMPLE_DATE, value),
  }));

  const phonePreview = formatPhoneValue(
    country.samples.phone,
    settings.country,
    { ...phoneOptions(settings), format: true },
  );
  const postalPreview = formatPostalValue(
    country.samples.postal,
    settings.country,
    { ...postalOptions(settings), format: true },
  );

  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.format.intro")}</p>

      <Section title={t("settings.format.countryTitle")}>
        <div className="flex flex-col gap-1.5">
          <SegmentedControl<CountryCode>
            value={settings.country}
            options={countryOptions}
            onChange={(next) => update("country", next)}
            fullWidth
            ariaLabel={t("settings.format.countryTitle")}
          />
          <p className="text-xs text-muted">
            {t("settings.format.countryHint")}
          </p>
        </div>
      </Section>

      <Section title={t("settings.format.phoneTitle")}>
        <ToggleRow
          label={t("settings.format.phoneEnable")}
          hint={t("settings.format.phoneEnableHint")}
          checked={settings.phoneFormat}
          onChange={(next) => update("phoneFormat", next)}
        />
        <NestedOptions enabled={settings.phoneFormat}>
          <ToggleRow
            label={t("settings.format.phoneCountryCode")}
            hint={t("settings.format.phoneCountryCodeHint")}
            checked={settings.phoneCountryCode}
            onChange={(next) => update("phoneCountryCode", next)}
          />
          <ToggleRow
            label={t("settings.format.phoneLeadingZero")}
            hint={t("settings.format.phoneLeadingZeroHint")}
            checked={settings.phoneLeadingZero}
            onChange={(next) => update("phoneLeadingZero", next)}
          />
        </NestedOptions>
        <Preview
          value={
            settings.phoneFormat
              ? phonePreview
              : t("settings.format.previewOff")
          }
        />
      </Section>

      <Section title={t("settings.format.postalTitle")}>
        <ToggleRow
          label={t("settings.format.postalEnable")}
          hint={t("settings.format.postalEnableHint")}
          checked={settings.postalFormat}
          onChange={(next) => update("postalFormat", next)}
        />
        <NestedOptions enabled={settings.postalFormat}>
          <ToggleRow
            label={t("settings.format.postalSpaces")}
            hint={t("settings.format.postalSpacesHint")}
            checked={settings.postalSpaces}
            onChange={(next) => update("postalSpaces", next)}
          />
        </NestedOptions>
        <Preview
          value={
            settings.postalFormat
              ? postalPreview
              : t("settings.format.previewOff")
          }
        />
      </Section>

      <Section title={t("settings.format.dateTitle")}>
        <div className="flex flex-col gap-1">
          <SelectPicker<DateFormat>
            value={settings.dateFormat}
            options={dateOptions}
            onChange={(next) => update("dateFormat", next)}
            ariaLabel={t("settings.format.dateTitle")}
          />
          <Preview value={formatDate(SAMPLE_DATE, settings.dateFormat)} />
          <p className="text-xs text-muted">{t("settings.format.dateHint")}</p>
        </div>
      </Section>
    </div>
  );
}

// The sub-toggles under a master switch. Kept mounted but dimmed and inert when
// the master is off, so the knobs stay discoverable without doing anything —
// the indent rule makes the nesting read at a glance.
function NestedOptions({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`mt-1 flex flex-col gap-2 border-l border-line pl-3 transition-opacity ${
        enabled ? "" : "pointer-events-none opacity-40"
      }`}
      aria-disabled={!enabled}
    >
      {children}
    </div>
  );
}

// A live "Sample: …" line echoing what the current options produce.
function Preview({ value }: { value: string }) {
  const t = useT();
  return (
    <p className="mt-1 text-xs text-muted">
      {t("settings.format.previewLabel")}{" "}
      <span className="font-mono text-fg">{value}</span>
    </p>
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
  // The file-picker import — the non-drag path to the same importer the
  // drag-and-drop overlay uses (see `ImportDropZone` / `import.ts`).
  const fileInput = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // A cloud backend only appears in the picker when its OAuth identifier is
  // baked into the build — an unconfigured backend can't be connected, so we
  // hide it rather than offer a dead option. `local` is always available.
  const backendOptions = [
    { value: "local" as const, label: t("settings.storage.backendThisDevice") },
    ...(DROPBOX_APP_KEY
      ? [
          {
            value: "dropbox" as const,
            label: t("settings.storage.backendDropbox"),
          },
        ]
      : []),
    ...(GOOGLE_CLIENT_ID
      ? [
          {
            value: "gdrive" as const,
            label: t("settings.storage.backendGdrive"),
          },
        ]
      : []),
  ];

  // The picker shows the *target* backend; an unconnected cloud pick shows its
  // Connect affordance until the OAuth flow lands.
  const [picked, setPicked] = useState(sync.backend);
  const pickedCloud = picked !== "local" ? picked : null;
  // Unconfigured backends are hidden above, so this only fires for a backend
  // persisted by an earlier build that had the key and this one doesn't —
  // still worth explaining rather than leaving the picker silently stuck.
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

  const runImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { contacts } = await readImportedContacts(Array.from(files));
    if (contacts.length === 0) {
      setImportMsg(t("import.none"));
      log.warn("import: no contacts found in picked file(s)");
      return;
    }
    const n = store.importContacts(contacts);
    if (n > 0) unlockTrophy("importer");
    setImportMsg(
      n === 1 ? t("import.doneOne") : t("import.done", { n: String(n) }),
    );
    log.info(`import: filed ${n} contact(s) from picked file(s)`);
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

      <Section title={t("settings.storage.importTitle")}>
        <p className="text-xs text-muted">
          {t("settings.storage.importIntro")}
        </p>
        <input
          ref={fileInput}
          type="file"
          accept={IMPORT_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            void runImport(e.target.files);
            // Reset so re-picking the same file fires `change` again.
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => fileInput.current?.click()}
          >
            {t("settings.storage.importChoose")}
          </Button>
          {importMsg && (
            <span className="text-sm text-success">{importMsg}</span>
          )}
        </div>
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
  // The "Fake data" toggle applies live and is in-memory only (not a staged
  // draft setting): flipping it swaps the store's storage backend for the
  // ephemeral seed backend immediately. See `useDevSeed`.
  const { active: fakeData, setActive: setFakeData } = useDevSeed();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.developer.intro")}</p>
      <Section title={t("settings.developer.fakeDataTitle")}>
        <ToggleRow
          label={t("settings.developer.fakeData")}
          hint={t("settings.developer.fakeDataHint")}
          checked={fakeData}
          onChange={setFakeData}
        />
      </Section>
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
