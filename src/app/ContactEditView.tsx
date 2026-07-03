// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import {
  Button,
  PlusIcon,
  Section,
  SegmentedControl,
  SelectPicker,
  ToggleRow,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import { autoArchiveAction, defaultAutoArchiveDate } from "./autoArchive.ts";
import { isValidFlexDate, parseFlexDate } from "./importantDates.ts";
import { useLang, useT } from "./i18n/index.ts";
import { freshId } from "./useContactStore.ts";
import type {
  Address,
  AutoArchiveAction,
  Contact,
  ContactMethodKind,
  Email,
  ImportantDate,
  Phone,
} from "./types.ts";
import { methodKind } from "./types.ts";

// The editable card body — reached from read mode by tapping the header
// pencil. The name and avatar live in the shared identity block above; this
// owns the field grid: phone numbers and emails (each typed private / work),
// postal addresses (each free-text titled), the detail fields, the birthday and
// any other important dates, and notes. Each field commits on blur, so every
// settled edit is one undoable step and one sync push.
export function ContactEditView({
  contact,
  updateContact,
}: {
  contact: Contact;
  updateContact: (id: string, patch: Partial<Contact>) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col">
      <Section title={t("contact.phones")}>
        <MethodRows<Phone>
          rows={contact.phones}
          placeholder={t("contact.phonePlaceholder")}
          inputMode="tel"
          addLabel={t("contact.addPhone")}
          removeLabel={t("contact.removeRow")}
          kindLabel={t("contact.phoneKind")}
          onCommit={(phones) => updateContact(contact.id, { phones })}
          makeRow={(value, kind) => ({
            id: freshId("phone"),
            value,
            label: kind,
          })}
        />
      </Section>

      <Section title={t("contact.emails")}>
        <MethodRows<Email>
          rows={contact.emails}
          placeholder={t("contact.emailPlaceholder")}
          inputMode="email"
          addLabel={t("contact.addEmail")}
          removeLabel={t("contact.removeRow")}
          kindLabel={t("contact.emailKind")}
          onCommit={(emails) => updateContact(contact.id, { emails })}
          makeRow={(value, kind) => ({
            id: freshId("email"),
            value,
            label: kind,
          })}
        />
      </Section>

      <Section title={t("contact.addresses")}>
        <AddressRows
          rows={contact.addresses}
          onCommit={(addresses) => updateContact(contact.id, { addresses })}
        />
      </Section>

      <Section title={t("contact.details")}>
        {/* The name lives in the identity block above (tap it to rename), so
            the details grid opens straight at company and birthday rather than
            repeating first / last name here. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledInput
            label={t("contact.company")}
            value={contact.company ?? ""}
            onCommit={(company) => updateContact(contact.id, { company })}
          />
          <LabeledInput
            label={t("contact.birthday")}
            value={contact.birthday ?? ""}
            type="date"
            onCommit={(birthday) => updateContact(contact.id, { birthday })}
          />
        </div>
      </Section>

      <Section title={t("contact.importantDates")}>
        <ImportantDateRows
          rows={contact.importantDates}
          onCommit={(importantDates) =>
            updateContact(contact.id, { importantDates })
          }
        />
      </Section>

      <Section title={t("contact.notes")}>
        <LabeledTextarea
          label={t("contact.notes")}
          hideLabel
          value={contact.notes ?? ""}
          rows={4}
          placeholder={t("contact.notesPlaceholder")}
          onCommit={(notes) => updateContact(contact.id, { notes })}
        />
      </Section>

      <Section title={t("contact.autoArchive")}>
        <AutoArchiveRow contact={contact} updateContact={updateContact} />
      </Section>
    </div>
  );
}

// The auto-archive control: a toggle that arms a self-filing schedule, and —
// once armed — a date to fire on and a choice of what happens then (shelve the
// card or delete it outright). Enabling seeds a date two weeks out so the card
// doesn't vanish the moment the switch is flipped; clearing the date disarms
// the schedule. The date and action commit straight to the store (each an
// undoable step), so the sweep on the next app open acts on the latest choice.
function AutoArchiveRow({
  contact,
  updateContact,
}: {
  contact: Contact;
  updateContact: (id: string, patch: Partial<Contact>) => void;
}) {
  const t = useT();
  const enabled = !!contact.autoArchiveDate?.trim();
  const action = autoArchiveAction(contact);

  const toggle = (on: boolean) => {
    updateContact(
      contact.id,
      on
        ? {
            autoArchiveDate: defaultAutoArchiveDate(new Date()),
            autoArchiveAction: action,
          }
        : { autoArchiveDate: undefined, autoArchiveAction: undefined },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <ToggleRow
        label={t("contact.autoArchiveToggle")}
        hint={t("contact.autoArchiveHint")}
        checked={enabled}
        onChange={toggle}
      />
      {enabled && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledInput
            label={t("contact.autoArchiveDate")}
            value={contact.autoArchiveDate ?? ""}
            type="date"
            onCommit={(date) =>
              updateContact(contact.id, {
                autoArchiveDate: date.trim() || undefined,
                ...(date.trim() ? {} : { autoArchiveAction: undefined }),
              })
            }
          />
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted">
              {t("contact.autoArchiveAction")}
            </span>
            <SegmentedControl<AutoArchiveAction>
              value={action}
              ariaLabel={t("contact.autoArchiveAction")}
              onChange={(next) =>
                updateContact(contact.id, { autoArchiveAction: next })
              }
              options={[
                { value: "archive", label: t("contact.autoArchiveArchive") },
                { value: "delete", label: t("contact.autoArchiveDelete") },
              ]}
            />
          </label>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full min-w-0 max-w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent";

// A labelled single-line field that holds its draft locally and commits on
// blur (or Enter) — so a settled edit is one undoable store step, not a
// commit per keystroke.
function LabeledInput({
  label,
  value,
  type = "text",
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={inputClass}
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  hideLabel = false,
  value,
  rows,
  placeholder,
  onCommit,
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  rows: number;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {!hideLabel && <span className="text-xs text-muted">{label}</span>}
      <textarea
        aria-label={hideLabel ? label : undefined}
        value={draft}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        className={`${inputClass} resize-y`}
      />
    </label>
  );
}

// --- Phones / emails (typed) --------------------------------------------------

type MethodRow = { id: string; value: string; label?: string };

// The private / work type picker shared by phone and email rows. A compact
// dropdown that sits at the head of the row, iOS-style: the type reads on the
// left, the value on the right.
function KindPicker({
  kind,
  ariaLabel,
  onChange,
}: {
  kind: ContactMethodKind;
  ariaLabel: string;
  onChange: (next: ContactMethodKind) => void;
}) {
  const t = useT();
  return (
    <SelectPicker<ContactMethodKind>
      value={kind}
      ariaLabel={ariaLabel}
      onChange={onChange}
      options={[
        { value: "private", label: t("contact.kindPrivate") },
        { value: "work", label: t("contact.kindWork") },
      ]}
      triggerClassName="flex w-[6.5rem] shrink-0 items-center justify-between gap-1 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg"
    />
  );
}

// An editable list of typed contact methods (phones, emails): each row carries
// a private / work type, commits its value on blur, the trash drops a row, and
// the add button appends an empty draft row. The rows prop is the committed
// truth; a just-added row lives locally until its first commit so an abandoned
// empty row never reaches the store.
function MethodRows<Row extends MethodRow>({
  rows,
  placeholder,
  inputMode,
  addLabel,
  removeLabel,
  kindLabel,
  onCommit,
  makeRow,
}: {
  rows: Row[];
  placeholder: string;
  inputMode: "tel" | "email";
  addLabel: string;
  removeLabel: string;
  kindLabel: string;
  onCommit: (rows: Row[]) => void;
  makeRow: (value: string, kind: ContactMethodKind) => Row;
}) {
  const [drafting, setDrafting] = useState(false);

  const commitRow = (id: string, value: string) => {
    const trimmed = value.trim();
    const next = trimmed
      ? rows.map((r) => (r.id === id ? { ...r, value: trimmed } : r))
      : rows.filter((r) => r.id !== id);
    if (JSON.stringify(next) !== JSON.stringify(rows)) onCommit(next);
  };

  const setRowKind = (id: string, kind: ContactMethodKind) => {
    onCommit(rows.map((r) => (r.id === id ? { ...r, label: kind } : r)));
  };

  const commitDraft = (value: string, kind: ContactMethodKind) => {
    setDrafting(false);
    const trimmed = value.trim();
    if (trimmed) onCommit([...rows, makeRow(trimmed, kind)]);
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <MethodValueRow
          key={row.id}
          initial={row.value}
          kind={methodKind(row.label)}
          placeholder={placeholder}
          inputMode={inputMode}
          removeLabel={removeLabel}
          kindLabel={kindLabel}
          onCommit={(v) => commitRow(row.id, v)}
          onKindChange={(k) => setRowKind(row.id, k)}
          onRemove={() => onCommit(rows.filter((r) => r.id !== row.id))}
        />
      ))}
      {drafting && (
        <MethodValueRow
          initial=""
          kind="private"
          autoFocus
          placeholder={placeholder}
          inputMode={inputMode}
          removeLabel={removeLabel}
          kindLabel={kindLabel}
          onCommit={(v, k) => commitDraft(v, k)}
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
          {addLabel}
        </span>
      </Button>
    </div>
  );
}

function MethodValueRow({
  initial,
  kind,
  autoFocus = false,
  placeholder,
  inputMode,
  removeLabel,
  kindLabel,
  onCommit,
  onKindChange,
  onRemove,
}: {
  initial: string;
  kind: ContactMethodKind;
  autoFocus?: boolean;
  placeholder: string;
  inputMode: "tel" | "email";
  removeLabel: string;
  kindLabel: string;
  // For a persisted row the kind is committed straight through `onKindChange`;
  // for the draft row (no `onKindChange`) it's held locally until the value
  // commits, so `onCommit` carries the chosen kind.
  onCommit: (value: string, kind: ContactMethodKind) => void;
  onKindChange?: (kind: ContactMethodKind) => void;
  onRemove: () => void;
}): ReactNode {
  const [draft, setDraft] = useState(initial);
  const [draftKind, setDraftKind] = useState(kind);
  return (
    <div className="flex items-center gap-2">
      <KindPicker
        kind={onKindChange ? kind : draftKind}
        ariaLabel={kindLabel}
        onChange={(k) => {
          if (onKindChange) onKindChange(k);
          else setDraftKind(k);
        }}
      />
      <input
        type={inputMode === "tel" ? "tel" : "email"}
        inputMode={inputMode}
        value={draft}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft, draftKind)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") onRemove();
        }}
        className={inputClass}
      />
      <RemoveButton label={removeLabel} onClick={onRemove} />
    </div>
  );
}

// --- Addresses ----------------------------------------------------------------

// An editable list of postal addresses. A card can hold several — a home, a
// cabin, a workplace — so each is its own bordered group with a free-text title
// (placeholder "Home") over the street / postal-code / city fields. "Add
// address" appends a fresh group; the trash removes one. Empty groups are
// harmless: the read view and export skip an address with no content.
function AddressRows({
  rows,
  onCommit,
}: {
  rows: Address[];
  onCommit: (rows: Address[]) => void;
}) {
  const t = useT();

  const patch = (id: string, part: Partial<Address>) =>
    onCommit(rows.map((a) => (a.id === id ? { ...a, ...part } : a)));

  return (
    <div className="flex flex-col gap-3">
      {rows.map((address) => (
        <div
          key={address.id}
          className="flex flex-col gap-2 rounded-md border border-line bg-surface-1 p-2.5"
        >
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <LabeledInput
                label={t("contact.addressTitle")}
                value={address.label ?? ""}
                placeholder={t("contact.addressTitlePlaceholder")}
                onCommit={(label) => patch(address.id, { label })}
              />
            </div>
            <RemoveButton
              label={t("contact.removeAddress")}
              onClick={() => onCommit(rows.filter((a) => a.id !== address.id))}
            />
          </div>
          <LabeledInput
            label={t("contact.street")}
            value={address.street ?? ""}
            onCommit={(street) => patch(address.id, { street })}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <LabeledInput
              label={t("contact.zip")}
              value={address.zip ?? ""}
              onCommit={(zip) => patch(address.id, { zip })}
            />
            <LabeledInput
              label={t("contact.city")}
              value={address.city ?? ""}
              onCommit={(city) => patch(address.id, { city })}
            />
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        className="self-start"
        onClick={() =>
          onCommit([...rows, { id: freshId("address"), label: "" }])
        }
      >
        <span className="flex items-center gap-1.5">
          <PlusIcon className="h-4 w-4" />
          {t("contact.addAddress")}
        </span>
      </Button>
    </div>
  );
}

// --- Important dates ----------------------------------------------------------

// An editable list of extra important dates (name day, anniversary, …). Each
// row pairs a free-text occasion with a flexible date — a month and day, plus an
// optional year. Leaving the year blank stores a day-and-month-only date. "Add
// date" seeds a new row at today's month/day so it's immediately valid.
function ImportantDateRows({
  rows,
  onCommit,
}: {
  rows: ImportantDate[];
  onCommit: (rows: ImportantDate[]) => void;
}) {
  const t = useT();

  const patch = (id: string, part: Partial<ImportantDate>) =>
    onCommit(rows.map((d) => (d.id === id ? { ...d, ...part } : d)));

  const addDate = () => {
    const now = new Date();
    const md = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    onCommit([...rows, { id: freshId("date"), label: "", date: md }]);
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-col gap-2 rounded-md border border-line bg-surface-1 p-2.5"
        >
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <LabeledInput
                label={t("contact.importantDateLabel")}
                value={row.label ?? ""}
                placeholder={t("contact.importantDateLabelPlaceholder")}
                onCommit={(label) => patch(row.id, { label })}
              />
            </div>
            <RemoveButton
              label={t("contact.removeImportantDate")}
              onClick={() => onCommit(rows.filter((d) => d.id !== row.id))}
            />
          </div>
          <FlexDateInput
            value={row.date}
            onChange={(date) => patch(row.id, { date })}
          />
        </div>
      ))}
      <Button variant="ghost" className="self-start" onClick={addDate}>
        <span className="flex items-center gap-1.5">
          <PlusIcon className="h-4 w-4" />
          {t("contact.addImportantDate")}
        </span>
      </Button>
    </div>
  );
}

const selectClass =
  "min-w-0 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent";

// The flexible date entry: a month select, a day select, and an optional year.
// A blank year stores the bare `MM-DD` the model uses for a day-and-month-only
// date; a four-digit year stores the full ISO date. Month names follow the UI
// language via `Intl`, so the control reads naturally in English or Swedish.
function FlexDateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const locale = lang === "sv" ? "sv-SE" : "en-GB";
  const parsed = parseFlexDate(value);
  const [month, setMonth] = useState(parsed ? pad(parsed.m) : "");
  const [day, setDay] = useState(parsed ? pad(parsed.d) : "");
  const [year, setYear] = useState(parsed?.y != null ? String(parsed.y) : "");

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale, { month: "long" }),
  );
  // Day 0 of the *next* month is the last day of this one; 2000 is a leap year
  // so February offers 29.
  const maxDay = month ? new Date(2000, Number(month), 0).getDate() : 31;
  const days = Array.from({ length: maxDay }, (_, i) => pad(i + 1));

  const commit = (m: string, d: string, y: string) => {
    if (!m || !d) {
      onChange("");
      return;
    }
    const yr = /^\d{4}$/.test(y) ? y : "";
    const candidate = yr ? `${yr}-${m}-${d}` : `${m}-${d}`;
    // A year that makes the day impossible (29 Feb in a common year) falls back
    // to the yearless form rather than being dropped.
    onChange(isValidFlexDate(candidate) ? candidate : `${m}-${d}`);
  };

  const onMonth = (m: string) => {
    const clampedDay =
      day && Number(day) > new Date(2000, Number(m), 0).getDate()
        ? pad(new Date(2000, Number(m), 0).getDate())
        : day;
    setMonth(m);
    setDay(clampedDay);
    commit(m, clampedDay, year);
  };

  return (
    <div className="flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs text-muted">{t("contact.dateMonth")}</span>
        <select
          value={month}
          onChange={(e) => onMonth(e.target.value)}
          className={selectClass}
        >
          <option value="" />
          {monthNames.map((name, i) => (
            <option key={i} value={pad(i + 1)}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-[4.5rem] shrink-0 flex-col gap-1">
        <span className="text-xs text-muted">{t("contact.dateDay")}</span>
        <select
          value={day}
          onChange={(e) => {
            setDay(e.target.value);
            commit(month, e.target.value, year);
          }}
          className={selectClass}
        >
          <option value="" />
          {days.map((d) => (
            <option key={d} value={d}>
              {String(Number(d))}
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-[5.5rem] shrink-0 flex-col gap-1">
        <span className="text-xs text-muted">{t("contact.dateYear")}</span>
        <input
          type="number"
          inputMode="numeric"
          value={year}
          placeholder="—"
          onChange={(e) => setYear(e.target.value)}
          onBlur={() => commit(month, day, year)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={selectClass}
        />
      </label>
    </div>
  );
}

// The shared trash affordance — a red-on-hover icon button that drops a row.
function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-danger/10 hover:text-danger"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
