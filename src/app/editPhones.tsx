// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import {
  Button,
  LABELED_FIELD_CLASS,
  PlusIcon,
  SelectPicker,
  type SelectOption,
} from "@niclaslindstedt/oss-framework/components";

import {
  COUNTRIES,
  getCountry,
  getCountryByCallingCode,
  type CountryCode,
} from "./countries/index.ts";
import { KindToggle, RemoveButton } from "./editWidgets.tsx";
import { StarIcon } from "./icons.tsx";
import { toStoredPhone } from "./format.ts";
import { useT } from "./i18n/index.ts";
import { withPrimaryPhone } from "./primaryPhone.ts";
import { freshId } from "./useContactStore.ts";
import type { ContactMethodKind, Phone } from "./types.ts";
import { methodKind } from "./types.ts";

// The phone-number editor. A phone is stored structured — bare national digits
// plus an E.164 calling code — so each row pairs a country dropdown (the code,
// defaulting to the home country) with a digits-only value field. The value
// commits stripped of every separator and country code (see `toStoredPhone`);
// paste a `+46 70…` and the code is peeled into the dropdown and the rest kept
// as digits. Like every other field, a settled edit is one undoable store step.
// (Emails stay on the generic `MethodRows` in `ContactEditView` — only phones
// carry the country code.)

/** Build the country-dropdown options, ensuring the current code is always one
 *  of them — a number whose code belongs to a country the app doesn't format
 *  for (a migrated `+81`) still shows and stays selectable as a bare `+81`. */
function countryOptions(
  current: string,
  t: ReturnType<typeof useT>,
): SelectOption<string>[] {
  const opts: SelectOption<string>[] = COUNTRIES.map((c) => {
    const name = t(
      `settings.format.country.${c.nameKey}` as Parameters<typeof t>[0],
    );
    return {
      value: c.callingCode,
      label: `${c.flag} ${name} +${c.callingCode}`,
      typeaheadLabel: `${name} +${c.callingCode}`,
    };
  });
  if (!opts.some((o) => o.value === current)) {
    opts.push({
      value: current,
      label: `+${current}`,
      typeaheadLabel: current,
    });
  }
  return opts;
}

// The compact trigger: the country's flag (a globe when the code is unknown)
// beside its `+code`. On the narrow mobile layout the `+code` is dropped so the
// trigger shrinks to just the flag, leaving more of the row for the value field
// — the open dropdown still spells out flag + name + code for every option. On
// `sm:` and wider there's room, so the `+code` rides alongside the flag.
const COUNTRY_TRIGGER =
  "flex cursor-pointer items-center gap-1 rounded-md border border-line " +
  "bg-surface-2 px-2 py-1.5 text-left text-sm text-fg hover:border-accent " +
  "focus-visible:border-accent focus-visible:outline-none";

function CountrySelect({
  code,
  ariaLabel,
  onChange,
}: {
  code: string;
  ariaLabel: string;
  onChange: (code: string) => void;
}) {
  const t = useT();
  const flag = getCountryByCallingCode(code)?.flag ?? "🌐";
  return (
    <div className="shrink-0" onMouseDownCapture={(e) => e.preventDefault()}>
      <SelectPicker<string>
        value={code}
        options={countryOptions(code, t)}
        onChange={onChange}
        ariaLabel={ariaLabel}
        typeahead
        triggerClassName={COUNTRY_TRIGGER}
        renderValue={() => (
          <span className="flex items-center gap-1 tabular-nums">
            <span aria-hidden>{flag}</span>
            <span className="sr-only sm:not-sr-only">+{code}</span>
          </span>
        )}
      />
    </div>
  );
}

// One editable phone row: the private/work toggle (person cards only), the
// primary star (multi-number cards only), the country dropdown, the digits-only
// value field, and the trash. A persisted row
// commits its country and kind straight through; the draft row holds them
// locally until its value first commits, so an abandoned empty row never lands.
function PhoneValueRow({
  initialValue,
  code,
  kind,
  showKind,
  showPrimary = false,
  primary = false,
  autoFocus = false,
  onCommit,
  onCountryChange,
  onKindChange,
  onTogglePrimary,
  onRemove,
}: {
  initialValue: string;
  code: string;
  kind: ContactMethodKind;
  showKind: boolean;
  // Whether to offer the primary-number star — only when a card holds more than
  // one number, so a single-number card stays uncluttered (its lone number is
  // implicitly the one to call).
  showPrimary?: boolean;
  primary?: boolean;
  autoFocus?: boolean;
  onCommit: (value: string, code: string, kind: ContactMethodKind) => void;
  onCountryChange?: (code: string) => void;
  onKindChange?: (kind: ContactMethodKind) => void;
  onTogglePrimary?: () => void;
  onRemove: () => void;
}): ReactNode {
  const t = useT();
  const [draft, setDraft] = useState(initialValue);
  const [draftCode, setDraftCode] = useState(code);
  const [draftKind, setDraftKind] = useState(kind);
  const activeCode = onCountryChange ? code : draftCode;
  const activeKind = onKindChange ? kind : draftKind;

  return (
    <div className="flex items-center gap-1.5">
      {showKind && (
        <KindToggle
          kind={activeKind}
          ariaLabel={t("contact.phoneKind")}
          onChange={(k) => {
            if (onKindChange) onKindChange(k);
            else setDraftKind(k);
          }}
        />
      )}
      {showPrimary && onTogglePrimary && (
        <PrimaryToggle primary={primary} onToggle={onTogglePrimary} />
      )}
      <CountrySelect
        code={activeCode}
        ariaLabel={t("contact.phoneCountry")}
        onChange={(c) => {
          if (onCountryChange) onCountryChange(c);
          else setDraftCode(c);
        }}
      />
      <input
        type="tel"
        inputMode="tel"
        value={draft}
        autoFocus={autoFocus}
        placeholder={t("contact.phonePlaceholder")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft, activeCode, activeKind)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") onRemove();
        }}
        className={LABELED_FIELD_CLASS}
      />
      <RemoveButton label={t("contact.removeRow")} onClick={onRemove} />
    </div>
  );
}

// The primary-number star that sits on a phone row when a card holds several
// numbers. A filled accent star marks the number that is primary; a hollow muted
// one marks the others — tap it to make that number primary instead, or tap the
// filled one to clear the choice. Like the kind and country pickers it captures
// the pointer press (cancelling the default) so tapping it while a value input is
// still focused doesn't blur-commit the field first, which would let a stale
// commit clobber a just-typed number.
function PrimaryToggle({
  primary,
  onToggle,
}: {
  primary: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const label = primary ? t("contact.clearPrimary") : t("contact.markPrimary");
  return (
    <span className="shrink-0" onMouseDownCapture={(e) => e.preventDefault()}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={primary}
        aria-label={label}
        title={label}
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors ${
          primary
            ? "text-accent hover:bg-accent/10"
            : "text-muted hover:bg-surface-2 hover:text-fg"
        }`}
      >
        <StarIcon className="h-4 w-4" filled={primary} />
      </button>
    </span>
  );
}

export function PhoneRows({
  rows,
  showKind,
  home,
  onCommit,
}: {
  rows: Phone[];
  // Whether to show the per-row private/work picker. A company card hides it.
  showKind: boolean;
  /** The home country — the code a code-less row and the draft default to. */
  home: CountryCode;
  onCommit: (rows: Phone[]) => void;
}) {
  const t = useT();
  const [drafting, setDrafting] = useState(false);
  const homeCode = getCountry(home).callingCode;
  // The primary-number star is only meaningful once a card holds more than one
  // number to choose between — a lone number is implicitly the one to call.
  const showPrimary = rows.length > 1;

  // Fold a typed value into a phone: national digits from `toStoredPhone`, and
  // the calling code it peeled off a pasted `+…`, falling back to the row's
  // current code. Absent digits drop the row.
  const withValue = (row: Phone, raw: string, fallbackCode: string): Phone => {
    const stored = toStoredPhone(raw);
    const code = stored.countryCode ?? fallbackCode;
    return { ...row, value: stored.value, countryCode: code };
  };

  const commitRow = (id: string, raw: string, code: string) => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const stored = toStoredPhone(raw);
    const next = stored.value
      ? rows.map((r) => (r.id === id ? withValue(r, raw, code) : r))
      : rows.filter((r) => r.id !== id);
    if (JSON.stringify(next) !== JSON.stringify(rows)) onCommit(next);
  };

  const setRowCountry = (id: string, code: string) =>
    onCommit(rows.map((r) => (r.id === id ? { ...r, countryCode: code } : r)));

  const setRowKind = (id: string, kind: ContactMethodKind) =>
    onCommit(rows.map((r) => (r.id === id ? { ...r, label: kind } : r)));

  const commitDraft = (raw: string, code: string, kind: ContactMethodKind) => {
    setDrafting(false);
    const stored = toStoredPhone(raw);
    if (!stored.value) return;
    onCommit([
      ...rows,
      {
        id: freshId("phone"),
        value: stored.value,
        countryCode: stored.countryCode ?? code,
        label: kind,
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <PhoneValueRow
          key={row.id}
          initialValue={row.value}
          code={row.countryCode ?? homeCode}
          kind={methodKind(row.label)}
          showKind={showKind}
          showPrimary={showPrimary}
          primary={!!row.primary}
          onCommit={(v) => commitRow(row.id, v, row.countryCode ?? homeCode)}
          onCountryChange={(c) => setRowCountry(row.id, c)}
          onKindChange={(k) => setRowKind(row.id, k)}
          onTogglePrimary={() =>
            onCommit(withPrimaryPhone(rows, row.primary ? null : row.id))
          }
          onRemove={() => onCommit(rows.filter((r) => r.id !== row.id))}
        />
      ))}
      {drafting && (
        <PhoneValueRow
          initialValue=""
          code={homeCode}
          // New numbers are most often work ones, so a fresh row defaults to
          // Work — the picker still flips it to Private per row.
          kind="work"
          showKind={showKind}
          autoFocus
          onCommit={(v, c, k) => commitDraft(v, c, k)}
          onRemove={() => setDrafting(false)}
        />
      )}
      <Button
        variant="ghost"
        className="self-start"
        onClick={() => setDrafting(true)}
      >
        <span className="flex items-center gap-1.5">
          <PlusIcon className="h-4 w-4" />
          {t("contact.addPhone")}
        </span>
      </Button>
    </div>
  );
}
