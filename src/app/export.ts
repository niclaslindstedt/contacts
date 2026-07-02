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

import type { Contact } from "./types.ts";
import { displayName } from "./types.ts";

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
      lines.push(`EMAIL;TYPE=INTERNET:${vEscape(e.value)}`);
    }
  }
  if (c.address?.trim()) {
    // The whole free-form address rides in the street slot; importers show it
    // verbatim rather than us guessing at a street/city/zip split.
    lines.push(`ADR;TYPE=HOME:;;${vEscape(c.address)};;;;`);
  }
  if (c.birthday?.trim()) lines.push(`BDAY:${vEscape(c.birthday)}`);
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

function phoneFor(c: Contact, kind: "mobile" | "home" | "work"): string {
  const byLabel = c.phones.find(
    (p) => (p.label ?? "").toLowerCase() === (kind === "work" ? "work" : kind),
  );
  if (byLabel) return byLabel.value;
  // Unlabelled numbers fill the mobile column, first come first served.
  if (kind === "mobile") {
    return c.phones.find((p) => !p.label)?.value ?? c.phones[0]?.value ?? "";
  }
  return "";
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
      c.address ?? "",
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
