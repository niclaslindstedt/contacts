// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import {
  ArchiveIcon,
  Button,
  PencilIcon,
  Section,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import { autoArchiveAction } from "./autoArchive.ts";
import { addressLines, hasAddress, mapsUrl } from "./address.ts";
import { ageOn, daysUntilBirthday } from "./birthday.ts";
import { birthdayIcs, dateEventIcs } from "./calendar.ts";
import { downloadText, MIME_ICS } from "./download.ts";
import { exportFileStem } from "./export.ts";
import {
  daysUntilDate,
  formatImportantDate,
  isValidFlexDate,
  yearsSince,
} from "./importantDates.ts";
import {
  BuildingIcon,
  CalendarIcon,
  GiftIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { formatDate } from "./format.ts";
import { formatPhoneValue, formatPostalValue } from "./countries/index.ts";
import {
  phoneOptions,
  postalOptions,
  type AppSettings,
} from "./useAppSettings.ts";
import type { Address, Contact, ImportantDate } from "./types.ts";
import { displayName, methodKind } from "./types.ts";

type Translate = ReturnType<typeof useT>;

// The default view when a contact is opened: its information laid out to be
// read, not edited. Phone numbers and emails become tap-to-act links tagged
// with their private / work type; addresses open in a map; the birthday and any
// other important dates read as dates and hand a yearly reminder to the device
// calendar. Only the parts a card actually carries are shown, so a sparse card
// stays uncluttered — and a wholly empty one gets a gentle nudge toward the
// pencil.
export function ContactReadView({
  contact,
  settings,
  onEdit,
}: {
  contact: Contact;
  // The app settings — supply the phone and date display formats.
  settings: AppSettings;
  // Jump straight into edit mode — used by the empty-card call to action.
  onEdit: () => void;
}) {
  const t = useT();

  const phones = contact.phones.filter((p) => p.value.trim());
  const emails = contact.emails.filter((e) => e.value.trim());
  const company = contact.company?.trim();
  const birthday = contact.birthday?.trim();
  const addresses = contact.addresses.filter(hasAddress);
  const dates = contact.importantDates.filter((d) => isValidFlexDate(d.date));
  const notes = contact.notes?.trim();
  // A valid, full-ISO auto-archive date drives the schedule banner; a
  // half-typed value stays hidden until it's a real date.
  const autoArchiveDate = contact.autoArchiveDate?.trim();
  const scheduled =
    autoArchiveDate && /^\d{4}-\d{2}-\d{2}$/.test(autoArchiveDate)
      ? autoArchiveDate
      : null;

  const hasContactMethods = phones.length > 0 || emails.length > 0;
  const hasDetails = !!company || !!birthday || dates.length > 0;
  const isEmpty =
    !hasContactMethods &&
    !hasDetails &&
    addresses.length === 0 &&
    !notes &&
    !scheduled;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
        <p className="max-w-sm text-sm text-muted">{t("contact.emptyHint")}</p>
        <Button variant="secondary" onClick={onEdit}>
          <span className="flex items-center gap-1.5">
            <PencilIcon className="h-4 w-4" />
            {t("contact.addDetails")}
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {hasContactMethods && (
        <Section title={t("contact.reachTitle")}>
          <div className="flex flex-col gap-1">
            {phones.map((phone) => (
              <ActionRow
                key={phone.id}
                href={`tel:${phone.value.replace(/\s+/g, "")}`}
                icon={<PhoneIcon className="h-4 w-4" />}
                label={kindLabel(phone.label, t)}
                value={formatPhoneValue(
                  phone.value,
                  settings.country,
                  phoneOptions(settings),
                )}
              />
            ))}
            {emails.map((email) => (
              <ActionRow
                key={email.id}
                href={`mailto:${email.value.trim()}`}
                icon={<MailIcon className="h-4 w-4" />}
                label={kindLabel(email.label, t)}
                value={email.value}
              />
            ))}
          </div>
        </Section>
      )}

      {hasDetails && (
        <Section title={t("contact.details")}>
          <div className="flex flex-col gap-1">
            {company && (
              <InfoRow
                icon={<BuildingIcon className="h-4 w-4" />}
                label={t("contact.company")}
                value={company}
              />
            )}
            {birthday && (
              <BirthdayRow
                iso={birthday}
                contact={contact}
                settings={settings}
              />
            )}
            {dates.map((date) => (
              <ImportantDateRow
                key={date.id}
                date={date}
                contact={contact}
                settings={settings}
              />
            ))}
          </div>
        </Section>
      )}

      {addresses.length > 0 && (
        <Section title={t("contact.addresses")}>
          <div className="flex flex-col gap-1">
            {addresses.map((address) => (
              <AddressRow
                key={address.id}
                address={address}
                settings={settings}
              />
            ))}
          </div>
        </Section>
      )}

      {notes && (
        <Section title={t("contact.notes")}>
          <p className="rounded-md border border-line bg-surface-1 px-3 py-2.5 text-sm whitespace-pre-line text-fg">
            {notes}
          </p>
        </Section>
      )}

      {scheduled && (
        <Section title={t("contact.autoArchive")}>
          <AutoArchiveRow
            iso={scheduled}
            action={autoArchiveAction(contact)}
            settings={settings}
          />
        </Section>
      )}
    </div>
  );
}

// The read-view banner for a scheduled self-filing: an icon that matches the
// outcome (archive box vs trash), the date it fires on, and a one-line note of
// what will happen then. Only shown when the contact carries a valid schedule.
function AutoArchiveRow({
  iso,
  action,
  settings,
}: {
  iso: string;
  action: "archive" | "delete";
  settings: AppSettings;
}) {
  const t = useT();
  const date = formatDate(iso, settings.dateFormat);
  return (
    <div className="flex items-start gap-3 px-2 py-2">
      <IconBadge>
        {action === "delete" ? (
          <TrashIcon className="h-4 w-4" />
        ) : (
          <ArchiveIcon className="h-4 w-4" />
        )}
      </IconBadge>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">
          {action === "delete"
            ? t("contact.autoArchiveDelete")
            : t("contact.autoArchiveArchive")}
        </span>
        <span className="text-sm text-fg">
          {action === "delete"
            ? t("contact.autoArchiveDeletesOn", { date })
            : t("contact.autoArchiveArchivesOn", { date })}
        </span>
      </span>
    </div>
  );
}

/** The read-view label for a phone / email row: its private or work type. */
function kindLabel(label: string | undefined, t: Translate): string {
  return methodKind(label) === "work"
    ? t("contact.kindWork")
    : t("contact.kindPrivate");
}

// A tappable contact method (phone / email): the value stands large, the
// framing icon sits in a tinted circle, and the whole row is the link target.
function ActionRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      title={value}
      className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-2"
    >
      <IconBadge>{icon}</IconBadge>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">{label}</span>
        <span className="truncate text-sm text-accent group-hover:underline">
          {value}
        </span>
      </span>
    </a>
  );
}

// A read-only detail (the company row): same shape as an action row, but the
// value is plain text — nothing to tap.
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-2 py-2">
      <IconBadge>{icon}</IconBadge>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">{label}</span>
        <span className="truncate text-sm text-fg">{value}</span>
      </span>
    </div>
  );
}

function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
      {children}
    </span>
  );
}
// The birthday row. Reads as a date (in the chosen date format) and splits into
// two taps: the date itself toggles to reveal the contact's current age, while
// the "days until" countdown chip hands the birthday off to the device calendar
// as a yearly-recurring event — the two things the raw date can't say or do at a
// glance. When today *is* the birthday the chip celebrates instead of counting.
function BirthdayRow({
  iso,
  contact,
  settings,
}: {
  iso: string;
  contact: Contact;
  settings: AppSettings;
}) {
  const t = useT();
  const [showAge, setShowAge] = useState(false);
  const now = new Date();
  const age = ageOn(iso, now);
  const days = daysUntilBirthday(iso, now);

  // Download a one-event `.ics` for the calendar app to open and add. Recurs
  // yearly and stays a single entry across re-imports via a stable UID.
  const addToCalendar = () => {
    const name = displayName(contact) || t("contact.unnamed");
    const ics = birthdayIcs({
      iso,
      summary: t("contact.birthdayEventTitle", { name }),
      uid: `birthday-${contact.id}@contacts.app`,
      now,
    });
    if (ics) {
      downloadText(`${exportFileStem(contact)}-birthday.ics`, ics, MIME_ICS);
    }
  };

  return (
    <DateRow
      icon={<CalendarIcon className="h-4 w-4" />}
      label={t("contact.birthday")}
      primary={formatDate(iso, settings.dateFormat)}
      secondary={
        age !== null ? t("contact.ageValue", { n: String(age) }) : null
      }
      showSecondary={showAge}
      onToggle={() => setShowAge((v) => !v)}
      toggleTitle={t("contact.showAge")}
      days={days}
      chipTitle={t("contact.addToCalendar")}
      onChip={addToCalendar}
      t={t}
    />
  );
}

// An important-date row (name day, anniversary, …). Same two-tap shape as the
// birthday: tapping the date reveals "N years" when the year is known, and the
// countdown chip hands a yearly reminder to the calendar — titled with the
// occasion and the contact's name ("Anniversary Sarah Connor").
function ImportantDateRow({
  date,
  contact,
  settings,
}: {
  date: ImportantDate;
  contact: Contact;
  settings: AppSettings;
}) {
  const t = useT();
  const [showYears, setShowYears] = useState(false);
  const now = new Date();
  const years = yearsSince(date.date, now);
  const days = daysUntilDate(date.date, now);
  const label = date.label?.trim() || t("contact.importantDate");

  const addToCalendar = () => {
    const name = displayName(contact) || t("contact.unnamed");
    // Weave the occasion together with the name, e.g. "Anniversary Sarah
    // Connor" — the reminder the user actually wants to see in their calendar.
    const summary = [date.label?.trim(), name].filter(Boolean).join(" ");
    const ics = dateEventIcs({
      value: date.date,
      summary,
      uid: `date-${date.id}@contacts.app`,
      now,
    });
    if (ics) {
      downloadText(`${exportFileStem(contact)}-${date.id}.ics`, ics, MIME_ICS);
    }
  };

  return (
    <DateRow
      icon={<GiftIcon className="h-4 w-4" />}
      label={label}
      primary={formatImportantDate(date.date, settings.dateFormat)}
      secondary={
        years !== null ? t("contact.yearsValue", { n: String(years) }) : null
      }
      showSecondary={showYears}
      onToggle={years !== null ? () => setShowYears((v) => !v) : undefined}
      toggleTitle={t("contact.showAge")}
      days={days}
      chipTitle={t("contact.addDateToCalendar")}
      onChip={addToCalendar}
      t={t}
    />
  );
}

// The shared date-row shape behind the birthday and important-date rows: an
// icon badge, a label over the formatted date (optionally toggling to a "years"
// readout), and a countdown chip that fires a calendar reminder. When there's
// nothing to toggle to, the date is plain text rather than a button.
function DateRow({
  icon,
  label,
  primary,
  secondary,
  showSecondary,
  onToggle,
  toggleTitle,
  days,
  chipTitle,
  onChip,
  t,
}: {
  icon: ReactNode;
  label: string;
  primary: string;
  secondary: string | null;
  showSecondary: boolean;
  onToggle?: () => void;
  toggleTitle: string;
  days: number | null;
  chipTitle: string;
  onChip: () => void;
  t: Translate;
}) {
  const value = showSecondary && secondary !== null ? secondary : primary;
  const body = (
    <>
      <IconBadge>{icon}</IconBadge>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">{label}</span>
        <span className="truncate text-sm text-fg">{value}</span>
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-2 pr-2">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={showSecondary}
          title={toggleTitle}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2">
          {body}
        </div>
      )}
      {days !== null && (
        <button
          type="button"
          onClick={onChip}
          title={chipTitle}
          className={`shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${
            days === 0 ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"
          }`}
        >
          {countdownLabel(days, t)}
        </button>
      )}
    </div>
  );
}

// Turn a days-until count into a short chip label: today, tomorrow, or "in N
// days".
function countdownLabel(days: number, t: Translate): string {
  if (days === 0) return t("contact.birthdayToday");
  if (days === 1) return t("contact.birthdayTomorrow");
  return t("contact.birthdayInDays", { n: String(days) });
}

// An address row. Same shape as an action row — the whole row is a link — but
// it opens the address in a maps app rather than dialling or composing. The
// row's label is the address's free-text title (falling back to the "Home"
// default). The postal code is shown in the chosen zip format; the maps query
// keeps the raw address so the lookup stays accurate.
function AddressRow({
  address,
  settings,
}: {
  address: Address;
  settings: AppSettings;
}) {
  const t = useT();
  const lines = addressLines({
    street: address.street,
    zip: formatPostalValue(
      address.zip ?? "",
      settings.country,
      postalOptions(settings),
    ),
    city: address.city,
  });
  return (
    <a
      href={mapsUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title={t("contact.openMaps")}
      className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-2"
    >
      <IconBadge>
        <MapPinIcon className="h-4 w-4" />
      </IconBadge>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">
          {address.label?.trim() || t("contact.addressTitlePlaceholder")}
        </span>
        <span className="text-sm whitespace-pre-line text-accent group-hover:underline">
          {lines.join("\n")}
        </span>
      </span>
    </a>
  );
}
