// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Parse a "copied name + email" clipboard string — the mailbox form mail
// clients and address books hand out when you copy someone, e.g.
// `Firstname Lastname <first.last@example.com>` (or a bare address) — into the
// name and email a new card is filed with. Kept pure and DOM-free so the paste
// handler in `App.tsx` stays a thin wrapper and the parsing is unit-testable in
// node (see `tests/pasteContact_test.ts`).

import { splitFullName } from "./types.ts";

/** A parsed clipboard contact: a split display name plus its address. */
export type PastedContact = {
  firstName: string;
  lastName: string;
  email: string;
};

// A single email address: something, an `@`, then a dotted domain — with no
// whitespace or angle brackets on either side. Deliberately strict so an
// ordinary paste (a sentence, a URL, a phone number) parses to `null` and is
// left untouched rather than hijacked into a new card.
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

// `Display Name <address>` — the RFC 5322 mailbox form. The name is optional (a
// leading `<` yields an empty name); the address is whatever sits inside the
// angle brackets.
const MAILBOX = /^(.*?)\s*<([^<>]+)>$/;

/** Strip one layer of matching surrounding quotes a mail client may wrap a
 *  display name in (`"Ada Lovelace" <…>`). */
function unquote(name: string): string {
  const m = /^"(.*)"$/.exec(name) ?? /^'(.*)'$/.exec(name);
  return (m ? m[1] : name).trim();
}

/**
 * Parse a clipboard string into a contact to file, or `null` when it is not a
 * single name/email mailbox. Only a lone address, or a `Name <address>` pair on
 * one line, is accepted — anything multi-line or otherwise shaped is rejected
 * so a normal paste is never turned into a contact.
 */
export function parsePastedContact(text: string): PastedContact | null {
  const trimmed = text.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;

  const mailbox = MAILBOX.exec(trimmed);
  const name = mailbox ? unquote(mailbox[1]) : "";
  const email = mailbox ? mailbox[2].trim() : trimmed;

  if (!EMAIL.test(email)) return null;

  return { ...splitFullName(name), email };
}
