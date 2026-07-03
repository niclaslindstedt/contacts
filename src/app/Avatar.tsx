// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ContactGlyph } from "./ContactGlyph.tsx";
import { PersonIcon } from "./icons.tsx";
import type { Contact } from "./types.ts";
import { initials } from "./types.ts";

// A contact's face, in one component for every size it appears at: the photo
// when there is one, else the picked glyph tinted by the card's accent, else
// the monogram initials, else the neutral person mark. The side-menu rows use
// the small `row` size; the appearance popover trigger uses `header`; the card
// identity block (read and edit) wears the large `hero` size.

export function Avatar({
  contact,
  size,
  className = "",
}: {
  contact: Contact;
  size: "row" | "header" | "hero";
  className?: string;
}) {
  const dim =
    size === "row"
      ? "h-5 w-5 text-[9px]"
      : size === "hero"
        ? "h-24 w-24 text-3xl"
        : "h-12 w-12 text-base";
  const iconDim =
    size === "row" ? "h-3.5 w-3.5" : size === "hero" ? "h-10 w-10" : "h-6 w-6";
  const tint = contact.color ? { color: contact.color } : undefined;

  if (contact.photo) {
    return (
      <img
        src={contact.photo}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  const mono = initials(contact);
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-semibold ${className}`}
      style={tint}
    >
      {contact.glyph ? (
        <ContactGlyph name={contact.glyph} className={iconDim} style={tint} />
      ) : mono ? (
        <span aria-hidden>{mono}</span>
      ) : (
        <PersonIcon className={iconDim} />
      )}
    </span>
  );
}
