// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The clipboard rendering of a contact card: what the read view shows, written
// out as Markdown. This is what the card toolbar's copy button puts on the
// clipboard — a card pasted into a note, a chat, or a ticket reads as a tidy
// little document rather than a wall of `BEGIN:VCARD` machinery.
//
// It renders the *card as read*, not the document as stored, so it mirrors
// `ContactReadView` section for section (Get in touch → Details → Tags →
// Addresses → Notes) and shows values in the same shape the user sees them —
// their phone/postal conventions and date format — with headings in the UI
// language. Deliberately left out: the photos and attachments (binary payloads
// that no Markdown paste can carry) and the card's app-local settings — the
// emergency flag, favorite, auto-archive schedule, glyph and colour — which
// configure how the app treats the card rather than being information *about*
// the person.
//
// Pure over the domain types — the translator and the display options come in
// as arguments — so the whole surface is unit-testable in node (see
// `tests/contactMarkdown_test.ts`). The card's own export formats (vCard, CSV,
// JSON) live in `export.ts`; this is not one of them.

import {
  addressLines,
  displayUrl,
  hasAddress,
  normalizeUrl,
} from "@niclaslindstedt/oss-framework/format";

import {
  formatPostalValue,
  formatStoredPhone,
  type CountryCode,
  type PhoneOptions,
  type PostalOptions,
} from "./countries/index.ts";
import { formatImportantDate, isValidFlexDate } from "./importantDates.ts";
import { formatDate, type DateFormat } from "./format.ts";
import { primaryPhone } from "./primaryPhone.ts";
import { relationLabel } from "./relation.ts";
import { contactTags } from "./tags.ts";
import type { TFn } from "./i18n/index.ts";
import type { Address, Contact } from "./types.ts";
import { displayName, methodKind } from "./types.ts";

/** Everything the renderer needs beyond the card itself: the translator for
 *  the headings and row labels, and the display conventions the read view
 *  formats dates, phone numbers, and postal codes with. Passed in rather than
 *  read from a hook or the settings store so this module stays pure. */
export type MarkdownOptions = {
  t: TFn;
  dateFormat: DateFormat;
  /** The home country whose phone / postal conventions values follow. */
  country: CountryCode;
  phone: PhoneOptions;
  postal: PostalOptions;
};

// Characters that would turn a plain value into Markdown markup. `_` is left
// alone on purpose: it is common inside email addresses and doesn't emphasise
// mid-word anyway, so escaping it would only litter the plain-text paste.
const ESCAPE = /[\\*`[\]]/g;

/** Neutralise Markdown markup in an inline value, so a company called `A*B`
 *  pastes as itself rather than as the start of an emphasis run. */
function esc(value: string): string {
  return value.replace(ESCAPE, "\\$&");
}

/** One `- **Label:** value` row. */
function row(label: string, value: string): string {
  return `- **${esc(label)}:** ${esc(value)}`;
}

/** A `## Heading` and its body, or nothing at all when the body is empty —
 *  a sparse card copies as sparsely as it reads. */
function section(title: string, body: string[]): string[] {
  return body.length === 0 ? [] : [`## ${esc(title)}`, "", ...body, ""];
}

/** The read view's label for a phone / email row: its private or work type. */
function kindLabel(label: string | undefined, t: TFn): string {
  return methodKind(label) === "work"
    ? t("contact.kindWork")
    : t("contact.kindPrivate");
}

/** One address as a single line — the read view's stacked lines joined up, so
 *  the whole card stays one flat list of rows. */
function addressValue(address: Address, o: MarkdownOptions): string {
  return addressLines({
    street: address.street,
    zip: formatPostalValue(address.zip ?? "", o.country, o.postal),
    city: address.city,
  }).join(", ");
}

/** The "Get in touch" rows: the phone numbers then the email addresses, each
 *  tagged with its private / work type, with the primary number marked when
 *  there is more than one to tell apart (as the read view badges it). */
function reachRows(c: Contact, o: MarkdownOptions): string[] {
  const phones = c.phones.filter((p) => p.value.trim());
  const emails = c.emails.filter((e) => e.value.trim());
  const primary = phones.length > 1 ? primaryPhone(phones) : undefined;
  return [
    ...phones.map((p) => {
      const label = `${o.t("contact.phone")} (${kindLabel(p.label, o.t)})`;
      const value = formatStoredPhone(p, o.country, o.phone);
      const line = row(label, value);
      return primary && p.id === primary.id
        ? `${line} (${esc(o.t("contact.primaryLabel"))})`
        : line;
    }),
    ...emails.map((e) =>
      row(
        `${o.t("contact.email")} (${kindLabel(e.label, o.t)})`,
        e.value.trim(),
      ),
    ),
  ];
}

/** The "Details" rows: company, relationship, website, birthday, and any other
 *  important dates — the same order, and the same omissions, as the read view.
 *  A company card is titled by its company name, so it doesn't repeat it here. */
function detailRows(c: Contact, o: MarkdownOptions): string[] {
  const rows: string[] = [];
  const company = c.isCompany ? "" : c.company?.trim();
  if (company) rows.push(row(o.t("contact.company"), company));
  const relation = relationLabel(c.relation, o.t);
  if (relation) rows.push(row(o.t("contact.relation"), relation));
  const homepage = c.homepage?.trim();
  if (homepage) {
    // A website is the one value worth linking: `displayUrl` drops the scheme
    // for reading, so the link keeps it clickable once rendered.
    rows.push(
      `- **${esc(o.t("contact.homepage"))}:** [${esc(
        displayUrl(homepage),
      )}](${normalizeUrl(homepage)})`,
    );
  }
  const birthday = c.birthday?.trim();
  if (birthday) {
    rows.push(row(o.t("contact.birthday"), formatDate(birthday, o.dateFormat)));
  }
  for (const d of c.importantDates) {
    if (!isValidFlexDate(d.date)) continue;
    rows.push(
      row(
        d.label?.trim() || o.t("contact.importantDate"),
        formatImportantDate(d.date, o.dateFormat),
      ),
    );
  }
  return rows;
}

/**
 * One contact card as a Markdown document: the name as the title, then a
 * section per group of information it actually carries. A card with nothing on
 * it is just its title.
 */
export function contactToMarkdown(c: Contact, o: MarkdownOptions): string {
  const tags = contactTags(c);
  const addresses = c.addresses.filter(hasAddress);
  const notes = c.notes?.trim();

  const lines: string[] = [
    `# ${esc(displayName(c) || o.t("contact.unnamed"))}`,
    "",
    ...section(o.t("contact.reachTitle"), reachRows(c, o)),
    ...section(o.t("contact.details"), detailRows(c, o)),
    ...section(
      o.t("contact.tags"),
      tags.length ? [tags.map(esc).join(", ")] : [],
    ),
    ...section(
      o.t("contact.addresses"),
      addresses.map((a) =>
        row(a.label?.trim() || o.t("contact.address"), addressValue(a, o)),
      ),
    ),
    // Notes are copied verbatim: they're the one free-text block a user may
    // well have written as Markdown themselves, and escaping would mangle it.
    ...section(o.t("contact.notes"), notes ? [notes] : []),
  ];

  // Sections leave a trailing blank line so they separate; the document itself
  // ends at its last line.
  return `${lines.join("\n").trimEnd()}\n`;
}
