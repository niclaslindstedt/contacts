// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

import {
  ArchiveIcon,
  Button,
  LABELED_FIELD_CLASS,
  LabeledInput,
  LabeledTextarea,
  NoteIcon,
  PlusIcon,
  Section,
  SegmentedControl,
  ToggleRow,
} from "@niclaslindstedt/oss-framework/components";

import {
  attachmentList,
  formatFileSize,
  isImageAttachment,
  withAttachmentAdded,
  withAttachmentRemoved,
  withAttachmentUpdated,
} from "./attachments.ts";
import { autoArchiveAction, defaultAutoArchiveDate } from "./autoArchive.ts";
import { filesToAttachments } from "./attachmentIntake.ts";
import { KindToggle, RemoveButton } from "./editWidgets.tsx";
import { PhoneRows } from "./editPhones.tsx";
import {
  BuildingIcon,
  FileIcon,
  GiftIcon,
  IceIcon,
  InfoIcon,
  MailIcon,
  MapPinIcon,
  PaperclipIcon,
  PhoneIcon,
  UploadIcon,
} from "./icons.tsx";
import { isValidFlexDate, parseFlexDate } from "./importantDates.ts";
import { log } from "./log.ts";
import { useLang, useT } from "./i18n/index.ts";
import { freshId } from "./useContactStore.ts";
import type { CountryCode } from "./countries/index.ts";
import type {
  Address,
  Attachment,
  AutoArchiveAction,
  Contact,
  ContactMethodKind,
  Email,
  ImportantDate,
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
  home,
  updateContact,
}: {
  contact: Contact;
  /** The home country — the phone editor's default calling code. */
  home: CountryCode;
  updateContact: (id: string, patch: Partial<Contact>) => void;
}) {
  const t = useT();
  // A company's numbers and emails are all just the company's — there's no
  // private/work person behind them — so the per-row kind picker drops out for
  // a company card. It stays for a person, where the distinction is real.
  const showKind = !contact.isCompany;
  return (
    <div className="flex flex-col">
      <Section
        icon={<PhoneIcon className="h-3.5 w-3.5" />}
        title={t("contact.phones")}
      >
        <PhoneRows
          rows={contact.phones}
          showKind={showKind}
          home={home}
          onCommit={(phones) => updateContact(contact.id, { phones })}
        />
      </Section>

      <Section
        icon={<MailIcon className="h-3.5 w-3.5" />}
        title={t("contact.emails")}
      >
        <MethodRows<Email>
          rows={contact.emails}
          placeholder={t("contact.emailPlaceholder")}
          inputMode="email"
          addLabel={t("contact.addEmail")}
          removeLabel={t("contact.removeRow")}
          kindLabel={t("contact.emailKind")}
          showKind={showKind}
          onCommit={(emails) => updateContact(contact.id, { emails })}
          makeRow={(value, kind) => ({
            id: freshId("email"),
            value,
            label: kind,
          })}
        />
      </Section>

      <Section
        icon={<MapPinIcon className="h-3.5 w-3.5" />}
        title={t("contact.addresses")}
      >
        <AddressRows
          rows={contact.addresses}
          onCommit={(addresses) => updateContact(contact.id, { addresses })}
        />
      </Section>

      <Section
        icon={<InfoIcon className="h-3.5 w-3.5" />}
        title={t("contact.details")}
      >
        {/* The name lives in the identity block above (tap it to rename), so
            the details grid opens straight at company and birthday rather than
            repeating first / last name here. The company switch itself now sits
            at the very bottom of the card, next to the emergency flag. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* A company's name is edited above (the identity block), so the
              redundant Company field only shows for a person. */}
          {!contact.isCompany && (
            <LabeledInput
              label={t("contact.company")}
              value={contact.company ?? ""}
              onCommit={(company) => updateContact(contact.id, { company })}
            />
          )}
          <LabeledInput
            label={t("contact.homepage")}
            value={contact.homepage ?? ""}
            type="url"
            placeholder={t("contact.homepagePlaceholder")}
            onCommit={(homepage) => updateContact(contact.id, { homepage })}
          />
          {/* A company has no birthday — that field is only meaningful for a
              person, so it drops out when the card is a company. */}
          {!contact.isCompany && (
            <LabeledInput
              label={t("contact.birthday")}
              value={contact.birthday ?? ""}
              type="date"
              onCommit={(birthday) => updateContact(contact.id, { birthday })}
            />
          )}
        </div>
      </Section>

      {/* Extra important dates are a person's affair (name days, anniversaries)
          — a company card hides the section, like the birthday above. */}
      {!contact.isCompany && (
        <Section
          icon={<GiftIcon className="h-3.5 w-3.5" />}
          title={t("contact.importantDates")}
        >
          <ImportantDateRows
            rows={contact.importantDates}
            onCommit={(importantDates) =>
              updateContact(contact.id, { importantDates })
            }
          />
        </Section>
      )}

      <Section
        icon={<NoteIcon className="h-3.5 w-3.5" />}
        title={t("contact.notes")}
      >
        <LabeledTextarea
          label={t("contact.notes")}
          hideLabel
          value={contact.notes ?? ""}
          rows={4}
          placeholder={t("contact.notesPlaceholder")}
          onCommit={(notes) => updateContact(contact.id, { notes })}
        />
      </Section>

      <Section
        icon={<PaperclipIcon className="h-3.5 w-3.5" />}
        title={t("contact.attachments")}
      >
        <AttachmentRows contact={contact} updateContact={updateContact} />
      </Section>

      {/* The in-case-of-emergency flag lives here near the bottom of edit mode —
          set once and out of the way — rather than always on show in the card
          header. A flagged card still pins to the top of the side menu. An
          emergency contact is a person you reach in a crisis, so the flag drops
          out for a company card, like the person-only fields above. */}
      {!contact.isCompany && (
        <Section
          icon={<IceIcon className="h-3.5 w-3.5" />}
          title={t("menu.emergency")}
        >
          <ToggleRow
            label={t("contact.iceToggle")}
            hint={t("contact.iceToggleHint")}
            checked={!!contact.ice}
            onChange={(on) => updateContact(contact.id, { ice: on })}
          />
        </Section>
      )}

      {/* Person ↔ company is a set-once choice, so it lives near the bottom
          beside the emergency flag rather than up in the details grid. Turning
          it on folds away the person-only fields (birthday, important dates)
          and edits the single company name in the identity block above. */}
      <Section
        icon={<BuildingIcon className="h-3.5 w-3.5" />}
        title={t("contact.cardType")}
      >
        <ToggleRow
          label={t("contact.companyToggle")}
          hint={t("contact.companyToggleHint")}
          checked={!!contact.isCompany}
          onChange={(on) => toggleCompany(contact, on, updateContact)}
        />
      </Section>

      {/* Auto-archive sits at the very bottom of the card — a set-and-forget
          schedule tucked below the person/company and emergency switches. */}
      <Section
        icon={<ArchiveIcon className="h-3.5 w-3.5" />}
        title={t("contact.autoArchive")}
      >
        <AutoArchiveRow contact={contact} updateContact={updateContact} />
      </Section>
    </div>
  );
}

// Flip a card between person and company. Turning it on, when the company name
// is still blank, promotes whatever name the card already had into the company
// field (and clears the first/last split) so a "Jane's Café" typed as a person
// isn't lost — the identity block then edits that one company name. It also
// drops the in-case-of-emergency flag: a company can't be an emergency contact,
// and the edit view hides that switch for a company, so a stale flag would
// otherwise be stuck on and keep pinning the card to the emergency list. Turning
// it off just drops the company flag; the company text stays put.
function toggleCompany(
  contact: Contact,
  on: boolean,
  updateContact: (id: string, patch: Partial<Contact>) => void,
): void {
  if (!on) {
    updateContact(contact.id, { isCompany: false });
    return;
  }
  const name = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const patch: Partial<Contact> = { isCompany: true, ice: false };
  if (!contact.company?.trim() && name) {
    patch.company = name;
    patch.firstName = "";
    patch.lastName = "";
  }
  updateContact(contact.id, patch);
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

// The attachments editor: upload files (a menu, a contract, a photo of a
// document), each with an optional description. Images preview as a thumbnail;
// everything else wears a file glyph. The picker reads each file to bytes and
// appends it; oversized / unreadable files are refused with an inline note
// rather than dropped silently. Each add / describe / remove is one undoable
// store step, like every other field.
function AttachmentRows({
  contact,
  updateContact,
}: {
  contact: Contact;
  updateContact: (id: string, patch: Partial<Contact>) => void;
}) {
  const t = useT();
  const rows = attachmentList(contact);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setRejected([]);
    try {
      const { attachments, rejected: refused } = await filesToAttachments(
        Array.from(files),
      );
      if (refused.length > 0) {
        setRejected(refused.map((r) => r.name));
        for (const r of refused) {
          log.warn(`attachment: refused ${r.name} (${r.reason})`);
        }
      }
      // Append the whole batch as one edit, threading each add so several files
      // picked at once all land.
      let patch: Partial<Contact> = {};
      let next = contact;
      for (const a of attachments) {
        patch = withAttachmentAdded(next, a);
        next = { ...next, ...patch };
      }
      if (attachments.length > 0) updateContact(contact.id, patch);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.map((attachment) => (
        <AttachmentEditRow
          key={attachment.id}
          attachment={attachment}
          onDescribe={(description) =>
            updateContact(
              contact.id,
              withAttachmentUpdated(contact, attachment.id, { description }),
            )
          }
          onRemove={() =>
            updateContact(
              contact.id,
              withAttachmentRemoved(contact, attachment.id),
            )
          }
        />
      ))}
      {rejected.length > 0 && (
        <p className="text-xs text-danger">
          {t("contact.attachmentTooLarge", { names: rejected.join(", ") })}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void pick(e.target.files)}
      />
      <Button
        variant="ghost"
        className="self-start"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <span className="flex items-center gap-1.5">
          <UploadIcon className="h-4 w-4" />
          {busy ? t("contact.attachmentReading") : t("contact.addAttachment")}
        </span>
      </Button>
    </div>
  );
}

// One attachment in the editor: a thumbnail (images) or file glyph beside the
// name and size, a description field, and the trash.
function AttachmentEditRow({
  attachment,
  onDescribe,
  onRemove,
}: {
  attachment: Attachment;
  onDescribe: (description: string) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const size = formatFileSize(attachment.size);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-1 p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-2 text-muted">
          {isImageAttachment(attachment) && attachment.data ? (
            <img
              src={attachment.data}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <FileIcon className="h-5 w-5" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-fg [overflow-wrap:anywhere]">
            {attachment.name}
          </span>
          {size && <span className="text-xs text-muted">{size}</span>}
        </span>
        <RemoveButton
          label={t("contact.removeAttachment")}
          onClick={onRemove}
        />
      </div>
      <LabeledInput
        label={t("contact.attachmentDescription")}
        value={attachment.description ?? ""}
        placeholder={t("contact.attachmentDescriptionPlaceholder")}
        onCommit={onDescribe}
      />
    </div>
  );
}

// --- Phones / emails (typed) --------------------------------------------------

type MethodRow = { id: string; value: string; label?: string };

// An editable list of typed contact methods (email addresses; phones have
// their own country-aware `PhoneRows`): each row carries
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
  showKind,
  onCommit,
  makeRow,
}: {
  rows: Row[];
  placeholder: string;
  inputMode: "tel" | "email";
  addLabel: string;
  removeLabel: string;
  kindLabel: string;
  // Whether to show the per-row private/work picker. A company card hides it —
  // its numbers and emails carry no personal kind.
  showKind: boolean;
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
          showKind={showKind}
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
          // New numbers and addresses are most often work ones, so a fresh row
          // defaults to Work — the picker still flips it to Private per row.
          kind="work"
          showKind={showKind}
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
  showKind,
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
  // Draw the private/work picker (person cards) or leave it off (company cards).
  showKind: boolean;
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
    <div className="flex items-center gap-1.5">
      {showKind && (
        <KindToggle
          kind={onKindChange ? kind : draftKind}
          ariaLabel={kindLabel}
          onChange={(k) => {
            if (onKindChange) onKindChange(k);
            else setDraftKind(k);
          }}
        />
      )}
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
        className={LABELED_FIELD_CLASS}
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
      {rows.map((row) => {
        // The occasion is required — a dateless "Anniversary" is meaningless,
        // and the calendar reminder and read-view label both lean on it. Flag
        // a blank one inline; the card still commits (there is no save gate),
        // but the empty field is clearly called out.
        const occasionMissing = !row.label?.trim();
        return (
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
                  required
                  invalid={occasionMissing}
                  onCommit={(label) => patch(row.id, { label })}
                />
              </div>
              <RemoveButton
                label={t("contact.removeImportantDate")}
                onClick={() => onCommit(rows.filter((d) => d.id !== row.id))}
              />
            </div>
            {occasionMissing && (
              <p className="text-xs text-danger">
                {t("contact.importantDateLabelRequired")}
              </p>
            )}
            <FlexDateInput
              value={row.date}
              onChange={(date) => patch(row.id, { date })}
            />
          </div>
        );
      })}
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

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
