// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Contact import — the inverse of `export.ts`. Address books (iOS Contacts,
// Android/Google, Outlook) hand contacts out as vCard `.vcf`, and the app
// exports (and re-imports) its own JSON backup and Outlook CSV; this module
// turns any of those back into the app's domain shape so a drag-and-drop — or a
// file picker — can pour foreign cards straight into the address book.
//
// The three readers each produce an {@link ImportedContact} — a card without an
// id, folder, or per-row ids. The store's `importContacts` action is what mints
// those and files the cards (see `useContactStore.ts`), keeping this whole
// surface pure and DOM-free so it is unit-testable in node (see
// `tests/import_test.ts`).

import { hasAddress } from "./address.ts";
import { parseDoc } from "./migrations.ts";
import type { Contact } from "./types.ts";
import { splitFullName } from "./types.ts";

/** A parsed card, ready for the store to id and file. Mirrors {@link Contact}
 *  minus the identity the store owns (`id`, `folderId`) and the per-row ids —
 *  the reader only ever knows the values. */
export type ImportedContact = {
  firstName: string;
  lastName: string;
  company?: string;
  phones: { value: string; label?: string }[];
  emails: { value: string; label?: string }[];
  addresses: { label?: string; street?: string; zip?: string; city?: string }[];
  birthday?: string;
  importantDates: { label?: string; date: string }[];
  notes?: string;
  photo?: string | null;
};

/** An empty draft with every list present — the reducers below fill it in. */
function emptyCard(): ImportedContact {
  return {
    firstName: "",
    lastName: "",
    phones: [],
    emails: [],
    addresses: [],
    importantDates: [],
  };
}

/** Whether a parsed card carries anything worth filing — a name, a company, or
 *  any contact method. A card with nothing on it is dropped rather than filed
 *  as a blank. */
export function hasContent(c: ImportedContact): boolean {
  return !!(
    c.firstName.trim() ||
    c.lastName.trim() ||
    c.company?.trim() ||
    c.phones.length ||
    c.emails.length ||
    c.addresses.length ||
    c.birthday?.trim() ||
    c.importantDates.length ||
    c.notes?.trim() ||
    c.photo
  );
}

// --- vCard -------------------------------------------------------------------

/** Undo the RFC 2426 §2.6 line folding: a CRLF (or LF) followed by a space or
 *  tab continues the previous line, and the folding whitespace is dropped. */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Reverse `vEscape` (see `export.ts`): a backslash escapes `\`, `;`, `,`, and
 *  `n`/`N` (a newline). Anything else after a backslash keeps the literal. */
function vUnescape(value: string): string {
  return value.replace(/\\(.)/g, (_, ch: string) =>
    ch === "n" || ch === "N" ? "\n" : ch,
  );
}

/** Decode a quoted-printable run — the encoding an old vCard 2.1 exporter
 *  (some Android builds) wraps non-ASCII values in. `=XX` is a byte; a soft
 *  line break (`=` at end of line) is already gone after unfolding. Bytes are
 *  gathered and read back as UTF-8. */
function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]!;
    if (ch === "=" && i + 2 < value.length) {
      const hex = value.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0));
  }
  try {
    return new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
  } catch {
    return value;
  }
}

/** One parsed content line: `[group.]NAME[;PARAM…]:VALUE`. Params collapse to a
 *  lower-cased map of value lists; bare params (vCard 2.1's `TEL;WORK;VOICE`)
 *  are folded under `type` so the same reader handles 2.1 and 3.0. */
type VLine = {
  group?: string;
  name: string;
  types: string[];
  params: Record<string, string[]>;
  value: string;
};

function parseLine(line: string): VLine | null {
  // Split at the first colon that isn't inside a quoted parameter value.
  let colon = -1;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') quoted = !quoted;
    else if (ch === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  let value = line.slice(colon + 1);

  const segments = head.split(";");
  let nameToken = segments[0] ?? "";
  let group: string | undefined;
  const dot = nameToken.indexOf(".");
  if (dot !== -1) {
    group = nameToken.slice(0, dot).toLowerCase();
    nameToken = nameToken.slice(dot + 1);
  }
  const name = nameToken.toUpperCase();

  const types: string[] = [];
  const params: Record<string, string[]> = {};
  for (const seg of segments.slice(1)) {
    const eq = seg.indexOf("=");
    if (eq === -1) {
      // Bare vCard 2.1 param — treat as a TYPE token.
      if (seg.trim()) types.push(seg.trim().toLowerCase());
      continue;
    }
    const key = seg.slice(0, eq).trim().toLowerCase();
    const vals = seg
      .slice(eq + 1)
      .split(",")
      .map((v) => v.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
    if (key === "type") types.push(...vals.map((v) => v.toLowerCase()));
    else params[key] = (params[key] ?? []).concat(vals);
  }

  // Decode the value per its declared encoding, then unescape vCard text.
  const encoding = (params.encoding ?? []).map((e) => e.toLowerCase());
  if (encoding.includes("quoted-printable")) {
    value = decodeQuotedPrintable(value);
  }

  return { group, name, types, params, value };
}

/** The private/work label the app stores, from a line's TYPE tokens. */
function methodLabel(types: string[]): string {
  return types.includes("work") ? "work" : "private";
}

/** A base64 `PHOTO` line's data URI, or null when it isn't embeddable. Handles
 *  the vCard 3.0 form (`PHOTO;ENCODING=b;TYPE=JPEG:<base64>`) and the vCard 4
 *  form where the value already is a `data:` URI. Remote `PHOTO;VALUE=uri:http…`
 *  references are skipped — the import stays self-contained. */
function photoDataUri(line: VLine): string | null {
  const value = line.value.trim();
  if (!value) return null;
  if (/^data:image\//i.test(value)) return value;
  const enc = (line.params.encoding ?? []).map((e) => e.toLowerCase());
  const isBase64 =
    enc.includes("b") ||
    enc.includes("base64") ||
    /^[A-Za-z0-9+/=\s]+$/.test(value);
  if (!isBase64) return null;
  const type = (line.types.find((t) => t !== "b" && t !== "base64") ?? "jpeg")
    .replace(/^image\//, "")
    .toLowerCase();
  const subtype = type === "png" ? "png" : "jpeg";
  return `data:image/${subtype};base64,${value.replace(/\s+/g, "")}`;
}

/** Strip Apple's `_$!<Label>!$_` wrapping off an `X-ABLABEL` value. */
function cleanLabel(raw: string): string {
  const m = /^_\$!<(.+)>!\$_$/.exec(raw.trim());
  return (m ? m[1]! : raw).trim();
}

/** Normalise a vCard date to the app's storage shape: a full `YYYY-MM-DD` when
 *  the year is known, or a bare `MM-DD` for a yearless (`--MMDD`) date. Accepts
 *  the compact `YYYYMMDD` basic form and trims any trailing time. Returns null
 *  when it isn't a recognisable date. */
function normalizeDate(
  raw: string,
): { full?: string; monthDay?: string } | null {
  const s = raw.trim();
  // Yearless: --MM-DD or --MMDD (vCard 4 / iOS "no year" birthdays).
  let m = /^--(\d{2})-?(\d{2})$/.exec(s);
  if (m) return { monthDay: `${m[1]}-${m[2]}` };
  // Full extended or basic, optionally with a time we discard.
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return { full: `${m[1]}-${m[2]}-${m[3]}` };
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  if (m) return { full: `${m[1]}-${m[2]}-${m[3]}` };
  return null;
}

/** Parse a `.vcf` payload — one or many cards — into importable drafts. Empty
 *  or contentless cards are dropped. Unknown properties are ignored, so an
 *  exporter's extra lines never break the import. */
export function parseVCards(text: string): ImportedContact[] {
  const lines = unfold(text);
  const cards: ImportedContact[] = [];
  let cur: ImportedContact | null = null;
  // Apple groups a date with its label across two lines (`item1.X-ABDATE`,
  // `item1.X-ABLABEL`); collect per-group so they can be married up per card.
  let dateGroups: Record<string, { date?: string; label?: string }> = {};
  let fnFallback = "";

  const flush = () => {
    if (!cur) return;
    // Fold any grouped X-ABDATE/X-ABLABEL pairs into important dates.
    for (const g of Object.values(dateGroups)) {
      if (!g.date) continue;
      const d = normalizeDate(g.date);
      const value = d?.full ?? d?.monthDay;
      if (value) cur.importantDates.push({ label: g.label, date: value });
    }
    // Fall back to FN when N gave us nothing.
    if (!cur.firstName && !cur.lastName && fnFallback) {
      const { firstName, lastName } = splitFullName(fnFallback);
      cur.firstName = firstName;
      cur.lastName = lastName;
    }
    cur.addresses = cur.addresses.filter(hasAddress);
    if (hasContent(cur)) cards.push(cur);
  };

  for (const rawLine of lines) {
    const upper = rawLine.trim().toUpperCase();
    if (upper === "BEGIN:VCARD") {
      cur = emptyCard();
      dateGroups = {};
      fnFallback = "";
      continue;
    }
    if (upper === "END:VCARD") {
      flush();
      cur = null;
      continue;
    }
    if (!cur) continue;
    const line = parseLine(rawLine);
    if (!line) continue;
    applyLine(cur, line, dateGroups, (fn) => {
      fnFallback = fn;
    });
  }
  return cards;
}

/** Fold one parsed property line into the card being built. Split out so the
 *  reader loop stays readable and the property map is easy to extend. */
function applyLine(
  cur: ImportedContact,
  line: VLine,
  dateGroups: Record<string, { date?: string; label?: string }>,
  setFn: (fn: string) => void,
): void {
  const v = vUnescape(line.value).trim();
  switch (line.name) {
    case "N": {
      // Family;Given;Additional;Prefix;Suffix
      const parts = line.value.split(";").map((p) => vUnescape(p).trim());
      cur.lastName = parts[0] ?? "";
      cur.firstName = [parts[1], parts[2]].filter(Boolean).join(" ");
      break;
    }
    case "FN":
      setFn(v);
      break;
    case "ORG":
      // ORG is `Company;Unit;…` — the first field is the company name.
      if (!cur.company)
        cur.company = vUnescape(line.value.split(";")[0] ?? "").trim();
      break;
    case "TEL":
      if (v) cur.phones.push({ value: v, label: methodLabel(line.types) });
      break;
    case "EMAIL":
      if (v) cur.emails.push({ value: v, label: methodLabel(line.types) });
      break;
    case "ADR": {
      // PObox;Ext;Street;City;Region;Postal;Country
      const parts = line.value.split(";").map((p) => vUnescape(p).trim());
      const label = line.types.includes("work")
        ? "Work"
        : line.types.includes("home")
          ? "Home"
          : undefined;
      cur.addresses.push({
        label,
        street: parts[2] || undefined,
        city: parts[3] || undefined,
        zip: parts[5] || undefined,
      });
      break;
    }
    case "BDAY": {
      const d = normalizeDate(v);
      if (d?.full) cur.birthday = d.full;
      else if (d?.monthDay)
        // A yearless birthday can't live in the birthday field (it wants a full
        // ISO date), so keep it as a labelled important date.
        cur.importantDates.push({ label: "Birthday", date: d.monthDay });
      break;
    }
    case "ANNIVERSARY": {
      const d = normalizeDate(v);
      const value = d?.full ?? d?.monthDay;
      if (value) cur.importantDates.push({ label: "Anniversary", date: value });
      break;
    }
    case "NOTE":
      if (v) cur.notes = cur.notes ? `${cur.notes}\n${v}` : v;
      break;
    case "PHOTO": {
      const uri = photoDataUri(line);
      if (uri && !cur.photo) cur.photo = uri;
      break;
    }
    case "X-ABDATE": {
      const key = line.group ?? `_anon${Object.keys(dateGroups).length}`;
      (dateGroups[key] ??= {}).date = v;
      break;
    }
    case "X-ABLABEL": {
      if (line.group) (dateGroups[line.group] ??= {}).label = cleanLabel(v);
      break;
    }
    default:
      break;
  }
}

// --- JSON (the app's own backup) ---------------------------------------------

/** Parse an app JSON backup (or the raw document) into importable drafts. Runs
 *  through the same migration pipeline the store uses, so an older backup is
 *  upgraded on the way in; per-row ids are dropped (the store re-mints them). */
export function parseJson(text: string): ImportedContact[] {
  const doc = parseDoc(text);
  return doc.contacts
    .filter((c) => !c.archived)
    .map((c) => fromContact(c))
    .filter(hasContent);
}

/** Strip a stored {@link Contact} back to an id-free draft. */
function fromContact(c: Contact): ImportedContact {
  return {
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    company: c.company,
    phones: c.phones.map((p) => ({ value: p.value, label: p.label })),
    emails: c.emails.map((e) => ({ value: e.value, label: e.label })),
    addresses: c.addresses
      .map((a) => ({
        label: a.label,
        street: a.street,
        zip: a.zip,
        city: a.city,
      }))
      .filter(hasAddress),
    birthday: c.birthday,
    importantDates: c.importantDates.map((d) => ({
      label: d.label,
      date: d.date,
    })),
    notes: c.notes ?? undefined,
    photo: c.photo ?? undefined,
  };
}

// --- CSV (Outlook columns) ---------------------------------------------------

/** Parse one CSV row, honouring RFC 4180 quoting (a `""` inside a quoted field
 *  is a literal quote). Returns the field list. */
function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i]!;
    if (quoted) {
      if (ch === '"') {
        if (row[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      fields.push(field);
      field = "";
    } else field += ch;
  }
  fields.push(field);
  return fields;
}

/** Split a CSV payload into logical rows — a newline inside a quoted field does
 *  not end a row. */
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let row = "";
  let quoted = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (ch === '"') quoted = !quoted;
    if (ch === "\n" && !quoted) {
      rows.push(row);
      row = "";
    } else row += ch;
  }
  if (row) rows.push(row);
  return rows.filter((r) => r.trim());
}

// Header aliases → the draft field they fill. Lower-cased; covers the columns
// the app itself exports plus the common Outlook / Google Contacts spellings.
const CSV_MAP: Record<string, string> = {
  "first name": "first",
  "given name": "first",
  "last name": "last",
  "family name": "last",
  company: "company",
  organization: "company",
  "mobile phone": "phoneMobile",
  "primary phone": "phoneMobile",
  "phone 1 - value": "phoneMobile",
  "home phone": "phoneHome",
  "business phone": "phoneWork",
  "work phone": "phoneWork",
  "e-mail address": "email1",
  "email address": "email1",
  "e-mail 1 - value": "email1",
  "e-mail 2 address": "email2",
  "home address": "address",
  "home street": "address",
  birthday: "birthday",
  notes: "notes",
};

/** Parse an Outlook/Google-style CSV into importable drafts. Unmapped columns
 *  are ignored; a row with no name and no contact method is dropped. */
export function parseCsv(text: string): ImportedContact[] {
  const rows = splitCsvRows(text);
  if (rows.length < 2) return [];
  const headers = parseCsvRow(rows[0]!).map((h) => h.trim().toLowerCase());
  const cards: ImportedContact[] = [];
  for (const raw of rows.slice(1)) {
    const cells = parseCsvRow(raw);
    const card = emptyCard();
    headers.forEach((header, i) => {
      const field = CSV_MAP[header];
      const value = (cells[i] ?? "").trim();
      if (!field || !value) return;
      switch (field) {
        case "first":
          card.firstName = value;
          break;
        case "last":
          card.lastName = value;
          break;
        case "company":
          card.company = value;
          break;
        case "phoneMobile":
          card.phones.push({ value, label: "private" });
          break;
        case "phoneHome":
          card.phones.push({ value, label: "private" });
          break;
        case "phoneWork":
          card.phones.push({ value, label: "work" });
          break;
        case "email1":
        case "email2":
          card.emails.push({ value, label: "private" });
          break;
        case "address": {
          // The Home Address column carries a comma- or newline-joined blob;
          // reuse the migration's best-effort splitter for structure.
          const parts = value.split(/,\s*/);
          card.addresses.push({
            label: "Home",
            street: parts[0] || undefined,
            city: parts.slice(1).join(", ") || undefined,
          });
          break;
        }
        case "birthday": {
          const d = normalizeDate(value);
          if (d?.full) card.birthday = d.full;
          break;
        }
        case "notes":
          card.notes = value;
          break;
        default:
          break;
      }
    });
    card.addresses = card.addresses.filter(hasAddress);
    if (hasContent(card)) cards.push(card);
  }
  return cards;
}

// --- dispatch ----------------------------------------------------------------

/** The formats a dropped/picked file can be. */
export type ImportFormat = "vcard" | "json" | "csv";

/** Pick a reader from a filename and the file's own bytes. The extension leads;
 *  when it's missing or unhelpful, the content is sniffed (a `BEGIN:VCARD`
 *  header, a leading `{`/`[`, else CSV). Returns null when nothing fits. */
export function detectFormat(
  filename: string,
  text: string,
): ImportFormat | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "vcf" || ext === "vcard") return "vcard";
  if (ext === "json") return "json";
  if (ext === "csv") return "csv";
  const head = text.trimStart();
  if (/^BEGIN:VCARD/i.test(head)) return "vcard";
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  if (head.includes(",")) return "csv";
  return null;
}

/** Parse a file's text with whichever reader its format calls for. Returns an
 *  empty list for an unrecognised or unparseable file rather than throwing, so
 *  a bad drop is a no-op the caller can report. */
export function parseImportFile(
  filename: string,
  text: string,
): ImportedContact[] {
  const format = detectFormat(filename, text);
  try {
    if (format === "vcard") return parseVCards(text);
    if (format === "json") return parseJson(text);
    if (format === "csv") return parseCsv(text);
  } catch {
    return [];
  }
  return [];
}
