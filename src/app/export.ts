// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Contact export. Contacts are *stored* as JSON (see `migrations.ts`); this
// module renders them into the interchange formats other address books
// import:
//
//   - vCard 3.0 (`.vcf`) — the format iOS Contacts, Android/Google Contacts,
//     and Outlook all import directly. One file can carry many cards.
//   - CSV — Outlook's "Import from another program or file" mapping (its
//     classic column names), which Google Contacts also understands.
//   - JSON — the app's own on-disk document, for backup / re-import.
//
// Pure functions over the domain types — no DOM here — so the whole surface
// is unit-testable in node (see `tests/export_test.ts`). The download glue
// (Blob + anchor click) lives in `download.ts`.

import { formatAddress, hasAddress } from "./address.ts";
import { parseFlexDate } from "./importantDates.ts";
import type { Contact } from "./types.ts";
import { displayName, methodKind } from "./types.ts";

// --- vCard -------------------------------------------------------------------

/** Escape a text value per RFC 2426: backslash, comma, semicolon, newline. */
function vEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets with a leading space on continuations,
 *  as RFC 2426 §2.6 prescribes. Folding on UTF-16 length is a close-enough
 *  proxy — importers accept shorter lines. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    parts.push(` ${line.slice(i, i + 74)}`);
  }
  return parts.join("\r\n");
}

/** Map a free-form phone label onto the vCard TEL TYPE set. */
function telType(label: string | undefined): string {
  switch ((label ?? "").toLowerCase()) {
    case "work":
      return "WORK";
    case "home":
      return "HOME";
    case "fax":
      return "FAX";
    default:
      return "CELL";
  }
}

/** One contact as a vCard 3.0 block. Cards with a photo embed it as a
 *  base64 PHOTO line (the data-URI payload), which iOS / Android / Outlook
 *  all restore on import. */
export function contactToVCard(c: Contact): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${vEscape(c.lastName)};${vEscape(c.firstName)};;;`);
  lines.push(`FN:${vEscape(displayName(c) || "Unnamed")}`);
  if (c.company?.trim()) lines.push(`ORG:${vEscape(c.company)}`);
  for (const p of c.phones) {
    if (p.value.trim()) {
      lines.push(`TEL;TYPE=${telType(p.label)}:${vEscape(p.value)}`);
    }
  }
  for (const e of c.emails) {
    if (e.value.trim()) {
      const type = methodKind(e.label) === "work" ? "WORK" : "HOME";
      lines.push(`EMAIL;TYPE=INTERNET,${type}:${vEscape(e.value)}`);
    }
  }
  for (const a of c.addresses) {
    if (hasAddress(a)) {
      // ADR fields, in RFC 2426 order: PO box; extended; street; city; region;
      // postal code; country. We carry street, city, and postal code. The
      // free-text title maps onto the closest standard TYPE (WORK / HOME).
      const type =
        (a.label ?? "").trim().toLowerCase() === "work" ? "WORK" : "HOME";
      lines.push(
        `ADR;TYPE=${type}:;;${vEscape(a.street ?? "")};${vEscape(
          a.city ?? "",
        )};;${vEscape(a.zip ?? "")};`,
      );
    }
  }
  if (c.birthday?.trim()) lines.push(`BDAY:${vEscape(c.birthday)}`);
  // Extra dates ride as Apple-style grouped X-ABDATE / X-ABLABEL items, which
  // iOS/macOS Contacts restore under their title. Only full (year-known) dates
  // export — vCard 3.0 has no clean yearless date.
  let item = 0;
  for (const d of c.importantDates) {
    const p = parseFlexDate(d.date);
    if (!p || p.y === null) continue;
    item += 1;
    const g = `item${item}`;
    lines.push(`${g}.X-ABDATE;VALUE=DATE:${vEscape(d.date)}`);
    lines.push(`${g}.X-ABLABEL:${vEscape(d.label?.trim() || "Date")}`);
  }
  if (c.notes?.trim()) lines.push(`NOTE:${vEscape(c.notes)}`);
  const photo = photoPayload(c.photo);
  if (photo) lines.push(`PHOTO;ENCODING=b;TYPE=${photo.type}:${photo.base64}`);
  lines.push("END:VCARD");
  return lines.map(fold).join("\r\n");
}

/** Extract the base64 payload + subtype from a `data:image/...;base64,` URI,
 *  or null when the photo is absent / not embeddable. */
function photoPayload(
  photo: string | null | undefined,
): { type: string; base64: string } | null {
  if (!photo) return null;
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(photo);
  if (!m) return null;
  return {
    type: m[1]!.toUpperCase() === "PNG" ? "PNG" : "JPEG",
    base64: m[2]!,
  };
}

/** Many contacts as one importable `.vcf` file. */
export function contactsToVCards(contacts: readonly Contact[]): string {
  return `${contacts.map(contactToVCard).join("\r\n")}\r\n`;
}

// --- CSV ----------------------------------------------------------------------

// Outlook's classic import headers. Google Contacts maps these too.
const CSV_HEADERS = [
  "First Name",
  "Last Name",
  "Company",
  "Mobile Phone",
  "Home Phone",
  "Business Phone",
  "E-mail Address",
  "E-mail 2 Address",
  "Home Address",
  "Birthday",
  "Notes",
] as const;

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function phoneFor(c: Contact, column: "mobile" | "home" | "work"): string {
  // Work-kind numbers fill the Business column. A legacy "home" label still
  // routes to the Home column; everything else (private / mobile / unlabelled)
  // fills the Mobile column, so nothing is silently dropped on export.
  const isHome = (label: string | undefined) =>
    (label ?? "").trim().toLowerCase() === "home";
  if (column === "work") {
    return c.phones.find((p) => methodKind(p.label) === "work")?.value ?? "";
  }
  if (column === "home") {
    return c.phones.find((p) => isHome(p.label))?.value ?? "";
  }
  return (
    c.phones.find((p) => methodKind(p.label) !== "work" && !isHome(p.label))
      ?.value ?? ""
  );
}

/** All contacts as an Outlook-compatible CSV. */
export function contactsToCsv(contacts: readonly Contact[]): string {
  const rows = contacts.map((c) =>
    [
      c.firstName,
      c.lastName,
      c.company ?? "",
      phoneFor(c, "mobile"),
      phoneFor(c, "home"),
      phoneFor(c, "work"),
      c.emails[0]?.value ?? "",
      c.emails[1]?.value ?? "",
      formatAddress(c.addresses.find(hasAddress) ?? {}),
      c.birthday ?? "",
      c.notes ?? "",
    ]
      .map(csvField)
      .join(","),
  );
  return [CSV_HEADERS.join(","), ...rows].join("\r\n") + "\r\n";
}

// --- filenames ------------------------------------------------------------------

/** A safe download filename stem for a contact ("ada-lovelace"). */
export function exportFileStem(c: Contact): string {
  const name = displayName(c) || "contact";
  return (
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "contact"
  );
}
