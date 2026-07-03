// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import {
  Button,
  PencilIcon,
  Section,
} from "@niclaslindstedt/oss-framework/components";

import {
  BuildingIcon,
  CalendarIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { formatDate, formatPhoneValue } from "./format.ts";
import type { AppSettings } from "./useAppSettings.ts";
import type { Contact } from "./types.ts";

// The default view when a contact is opened: its information laid out to be
// read, not edited. Phone numbers and emails become tap-to-act links; the
// details and notes render as plain, legible text. Only the parts a card
// actually carries are shown, so a sparse card stays uncluttered — and a wholly
// empty one gets a gentle nudge toward the pencil.
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
  const address = contact.address?.trim();
  const notes = contact.notes?.trim();

  const hasContactMethods = phones.length > 0 || emails.length > 0;
  const hasDetails = !!company || !!birthday || !!address;
  const isEmpty = !hasContactMethods && !hasDetails && !notes;

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
                label={t("contact.phone")}
                value={formatPhoneValue(phone.value, settings.phoneFormat)}
              />
            ))}
            {emails.map((email) => (
              <ActionRow
                key={email.id}
                href={`mailto:${email.value.trim()}`}
                icon={<MailIcon className="h-4 w-4" />}
                label={t("contact.email")}
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
              <InfoRow
                icon={<CalendarIcon className="h-4 w-4" />}
                label={t("contact.birthday")}
                value={formatDate(birthday, settings.dateFormat)}
              />
            )}
            {address && (
              <InfoRow
                icon={<MapPinIcon className="h-4 w-4" />}
                label={t("contact.address")}
                value={address}
                multiline
              />
            )}
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
    </div>
  );
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

// A read-only detail (company / birthday / address): same shape as an action
// row, but the value is plain text — nothing to tap.
function InfoRow({
  icon,
  label,
  value,
  multiline = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-2 py-2">
      <IconBadge>{icon}</IconBadge>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">{label}</span>
        <span
          className={`text-sm text-fg ${multiline ? "whitespace-pre-line" : "truncate"}`}
        >
          {value}
        </span>
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
