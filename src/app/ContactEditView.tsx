// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import {
  Button,
  PlusIcon,
  Section,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";
import { freshId } from "./useContactStore.ts";
import type { Contact, Email, Phone } from "./types.ts";

// The editable card body — reached from read mode by tapping the header
// pencil. The name and avatar live in the shared identity block above; this
// owns the field grid: phone numbers, emails, and the detail fields. Each
// field commits on blur, so every settled edit is one undoable step and one
// sync push.
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
        <FieldRows<Phone>
          rows={contact.phones}
          placeholder={t("contact.phonePlaceholder")}
          inputMode="tel"
          addLabel={t("contact.addPhone")}
          removeLabel={t("contact.removeRow")}
          onCommit={(phones) => updateContact(contact.id, { phones })}
          makeRow={(value) => ({ id: freshId("phone"), value })}
        />
      </Section>

      <Section title={t("contact.emails")}>
        <FieldRows<Email>
          rows={contact.emails}
          placeholder={t("contact.emailPlaceholder")}
          inputMode="email"
          addLabel={t("contact.addEmail")}
          removeLabel={t("contact.removeRow")}
          onCommit={(emails) => updateContact(contact.id, { emails })}
          makeRow={(value) => ({ id: freshId("email"), value })}
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
        <LabeledInput
          label={t("contact.street")}
          value={contact.street ?? ""}
          onCommit={(street) => updateContact(contact.id, { street })}
        />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledInput
            label={t("contact.zip")}
            value={contact.zip ?? ""}
            onCommit={(zip) => updateContact(contact.id, { zip })}
          />
          <LabeledInput
            label={t("contact.city")}
            value={contact.city ?? ""}
            onCommit={(city) => updateContact(contact.id, { city })}
          />
        </div>
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
  onCommit,
}: {
  label: string;
  value: string;
  type?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        type={type}
        value={draft}
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

// An editable list of one-line values (phones, emails): each row commits on
// blur, the trash drops a row, and the add button appends an empty draft row.
// The rows prop is the committed truth; a just-added row lives locally until
// its first commit so an abandoned empty row never reaches the store.
function FieldRows<Row extends { id: string; value: string }>({
  rows,
  placeholder,
  inputMode,
  addLabel,
  removeLabel,
  onCommit,
  makeRow,
}: {
  rows: Row[];
  placeholder: string;
  inputMode: "tel" | "email";
  addLabel: string;
  removeLabel: string;
  onCommit: (rows: Row[]) => void;
  makeRow: (value: string) => Row;
}) {
  const [drafting, setDrafting] = useState(false);

  const commitRow = (id: string, value: string) => {
    const trimmed = value.trim();
    const next = trimmed
      ? rows.map((r) => (r.id === id ? { ...r, value: trimmed } : r))
      : rows.filter((r) => r.id !== id);
    if (JSON.stringify(next) !== JSON.stringify(rows)) onCommit(next);
  };

  const commitDraft = (value: string) => {
    setDrafting(false);
    const trimmed = value.trim();
    if (trimmed) onCommit([...rows, makeRow(trimmed)]);
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <ValueRow
          key={row.id}
          initial={row.value}
          placeholder={placeholder}
          inputMode={inputMode}
          removeLabel={removeLabel}
          onCommit={(v) => commitRow(row.id, v)}
          onRemove={() => onCommit(rows.filter((r) => r.id !== row.id))}
        />
      ))}
      {drafting && (
        <ValueRow
          initial=""
          autoFocus
          placeholder={placeholder}
          inputMode={inputMode}
          removeLabel={removeLabel}
          onCommit={commitDraft}
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

function ValueRow({
  initial,
  autoFocus = false,
  placeholder,
  inputMode,
  removeLabel,
  onCommit,
  onRemove,
}: {
  initial: string;
  autoFocus?: boolean;
  placeholder: string;
  inputMode: "tel" | "email";
  removeLabel: string;
  onCommit: (value: string) => void;
  onRemove: () => void;
}): ReactNode {
  const [draft, setDraft] = useState(initial);
  return (
    <div className="flex items-center gap-2">
      <input
        type={inputMode === "tel" ? "tel" : "email"}
        inputMode={inputMode}
        value={draft}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") onRemove();
        }}
        className={inputClass}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-danger/10 hover:text-danger"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
