// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Avatar as FrameworkAvatar,
  BuildingIcon,
  PersonIcon,
  type AvatarSize as FrameworkAvatarSize,
} from "@niclaslindstedt/oss-framework/components";
import { Glyph } from "@niclaslindstedt/oss-framework/glyphs";

import { CONTACT_GLYPH_PATHS } from "./contactGlyphs.ts";
import { activePhoto } from "./contactPhotos.ts";
import type { Contact } from "./types.ts";
import { initials } from "./types.ts";

// A contact's face, in one component for every size it appears at: the photo
// when there is one, else the picked glyph tinted by the card's accent, else
// the monogram initials, else the neutral person mark. The side-menu rows use
// the small `row` size; the appearance popover trigger uses `header`; the card
// identity block (read and edit) wears the large `hero` size.
//
// A thin domain wrapper over the framework `Avatar` (whose size scale was
// ported from this file): it only maps a `Contact` onto the framework's
// layers — photo src, glyph (drawn from the app's contact catalogue), company
// mark, monogram, person fallback — and translates the app's size names.

// The list view sizes sit between the terse `row` and the card's `header`:
// `list-compact` keeps rows dense, `list-spacious` blows the photo up so it's
// easy to see at a glance (see the List settings tab's card-size toggle).
const SIZE: Record<AvatarSize, FrameworkAvatarSize> = {
  row: "xs",
  "list-compact": "sm",
  header: "md",
  "list-spacious": "lg",
  hero: "xl",
};

export type AvatarSize =
  "row" | "list-compact" | "header" | "list-spacious" | "hero";

export function Avatar({
  contact,
  size,
  className = "",
}: {
  contact: Contact;
  size: AvatarSize;
  className?: string;
}) {
  // A picked glyph wins over everything but a photo; a company with neither
  // photo nor glyph reads as a building rather than a monogram — the flip
  // switch's visible tell.
  const icon = contact.glyph ? (
    <Glyph
      name={contact.glyph}
      paths={CONTACT_GLYPH_PATHS}
      fallback={<PersonIcon />}
    />
  ) : contact.isCompany ? (
    <BuildingIcon />
  ) : undefined;

  return (
    <FrameworkAvatar
      src={activePhoto(contact)?.photo ?? null}
      icon={icon}
      initials={initials(contact) || undefined}
      fallback={<PersonIcon />}
      tintColor={contact.color ?? null}
      size={SIZE[size]}
      className={className}
    />
  );
}
