// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { IconProps } from "@niclaslindstedt/oss-framework/components";

// The few glyphs the app needs that the framework's neutral set doesn't ship
// (the framework keeps domain/dev-specific marks app-side). Traced on
// Lucide's 24×24 grid to match the framework family's weight. Everything the
// framework publishes (person, phone, mail, star, …) is imported from
// `@niclaslindstedt/oss-framework/components` directly — only the app-only
// marks live here.

/** A siren — the in-case-of-emergency (ICE) mark. Flags a contact as an
 *  emergency contact: it heads the pinned "In case of emergency" section at the
 *  top of the side menu, badges the flagged row, and toggles the state from the
 *  card header. The single most legible "emergency" glyph, and used nowhere
 *  else. */
export function IceIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
      <path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1z" />
      <path d="M21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.9 4.9l.7.7M12 12v6" />
    </svg>
  );
}

/** A fold / unfold-vertical glyph — the shared "collapse all / expand all"
 *  affordance worn by both the list view's header button and the sidebar's
 *  "Contacts" header button, so the two read identically. Chevron-based (never
 *  the folder mark) so it reads as "fold these rows together". `collapsed`
 *  shows the outward (unfold) arrows when everything is already folded — one
 *  tap expands them all again — and the inward (fold) arrows otherwise. */
export function SectionsToggleIcon({
  className,
  collapsed,
}: IconProps & { collapsed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M12 22v-6M12 8V2M4 12H2M10 12H8M16 12h-2M22 12h-2" />
      {collapsed ? (
        <path d="m15 19-3 3-3-3M15 5l-3-3-3 3" />
      ) : (
        <path d="m15 19-3-3-3 3M15 5l-3 3-3-3" />
      )}
    </svg>
  );
}

/** A heart — the favorite affordance. Outline when a card isn't starred, a
 *  solid fill when it is, so the toggle reads its state at a glance. The
 *  Favorites page and the List / card toggles all draw this one mark, and the
 *  side-menu Donate link wears the filled variant — so every heart in the app
 *  is this one true, symmetric shape rather than the framework's skewed glyph. */
export function FavoriteIcon({
  className,
  filled,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

/** A hash / number sign — the Format surface (date, phone, and postal-code
 *  display styles). */
export function FormatIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}
