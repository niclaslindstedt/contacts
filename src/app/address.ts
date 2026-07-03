// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The postal-address helpers. A contact stores its address as three structured
// fields — `street`, `zip`, `city` (see `types.ts`) — rather than one free-form
// blob, so the read view can lay it out as a proper address and hand a clean
// query to a maps app. This module is the pure seam over those fields: render
// them for display, build a maps deep link, and best-effort parse an old
// free-form string back into the three parts (used by the v2 migration).
//
// Pure functions over a plain `Address` shape — no DOM — so the whole surface
// is unit-testable in node (see `tests/address_test.ts`).

/** The postal-address subset of a contact card. */
export type Address = {
  street?: string;
  zip?: string;
  city?: string;
};

/** Whether any of the three parts carries content. */
export function hasAddress(a: Address): boolean {
  return !!(a.street?.trim() || a.zip?.trim() || a.city?.trim());
}

/** The address as display lines — the street on its own line, then the
 *  "zip city" locality line — with blank parts dropped. */
export function addressLines(a: Address): string[] {
  const lines: string[] = [];
  const street = a.street?.trim();
  if (street) lines.push(street);
  const locality = [a.zip?.trim(), a.city?.trim()].filter(Boolean).join(" ");
  if (locality) lines.push(locality);
  return lines;
}

/** The address as one comma-joined line — the maps query and the search /
 *  export representation. */
export function formatAddress(a: Address): string {
  return addressLines(a).join(", ");
}

/** A universal maps deep link for the address. The `?api=1&query=` Google Maps
 *  search URL is the portable choice: on a phone the OS hands it off to the
 *  installed map app, and on the desktop it opens Google Maps in the browser. */
export function mapsUrl(a: Address): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    formatAddress(a),
  )}`;
}

// Match a "zip city" or "city zip" locality — a postal code is a run of 4–6
// digits (optionally split once, as Swedish "123 45") sitting beside the town.
function splitLocality(s: string): { zip: string; city: string } | null {
  const text = s.trim();
  let m = /^(\d{3}\s?\d{2}|\d{4,6})\s+(.+)$/.exec(text);
  if (m) return { zip: m[1]!.replace(/\s+/g, " "), city: m[2]!.trim() };
  m = /^(.+?)\s+(\d{3}\s?\d{2}|\d{4,6})$/.exec(text);
  if (m) return { zip: m[2]!.replace(/\s+/g, " "), city: m[1]!.trim() };
  return null;
}

/** Best-effort split of a free-form (possibly multi-line) address into the
 *  three structured parts. Used once, by the v1→v2 migration, to carry an old
 *  single-field address forward; it never has to be perfect, only sensible. */
export function parseAddress(raw: string): Address {
  const text = raw.trim();
  if (!text) return {};
  // Prefer explicit line breaks; fall back to comma separation on one line.
  const segments = (text.includes("\n") ? text.split(/\n+/) : text.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return {};
  if (segments.length === 1) {
    const locality = splitLocality(segments[0]!);
    return locality ?? { street: segments[0] };
  }
  const street = segments.slice(0, -1).join(", ");
  const tail = segments[segments.length - 1]!;
  const locality = splitLocality(tail);
  return locality ? { street, ...locality } : { street, city: tail };
}
