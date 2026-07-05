// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { IconProps } from "@niclaslindstedt/oss-framework/components";

// A few glyphs the app needs that the framework's neutral set doesn't ship
// (the framework keeps domain/dev-specific marks app-side). Traced on
// Lucide's 24×24 grid to match the framework family's weight.

/** A person silhouette — the neutral default mark for a contact that carries
 *  no photo and no custom glyph. The side-menu rows, the card header's avatar,
 *  and the appearance popover's "clear" cell all draw this one mark, so the
 *  icon a card shows and the icon its picker clears back to never drift. */
export function PersonIcon({ className }: IconProps) {
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 16 0v1" />
    </svg>
  );
}

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

/** A row of lines with leading dots — the contact list / overview surface (the
 *  side-menu button that opens the full-page list and its Settings tab). */
export function ListIcon({ className }: IconProps) {
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
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </svg>
  );
}

/** A square with a checkmark — the "Select" affordance on the list view's
 *  header that flips the rows into multi-select. */
export function CheckSquareIcon({ className }: IconProps) {
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
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

/** A fold / unfold-vertical glyph — the "collapse all / expand all sections"
 *  affordance on the list view's header. Chevron-based (never the folder mark)
 *  so it reads as "fold these rows together", matching the list's separator
 *  styling rather than the sidebar's folder icons. `collapsed` shows the
 *  outward (unfold) arrows when everything is already folded — one tap expands
 *  them all again — and the inward (fold) arrows otherwise. */
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

/** Angle brackets — the Developer surface. */
export function CodeIcon({ className }: IconProps) {
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
      <path d="m8 16-4-4 4-4M16 8l4 4-4 4M14 4l-4 16" />
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

/** An image with an up-arrow — the "upload photo" affordance in the photo
 *  section of the appearance popover. */
export function ImageUpIcon({ className }: IconProps) {
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
      <path d="M14.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9.5" />
      <path d="m4 16 4-4a2 2 0 0 1 2.7-.1L16 16" />
      <path d="M14 14l1-1a2 2 0 0 1 2.7-.1L20 14" />
      <circle cx="9" cy="9" r="1.4" />
      <path d="M19 8V2M16 5l3-3 3 3" />
    </svg>
  );
}

/** A crop frame — the "adjust photo" affordance (re-zoom/pan the circle). */
export function CropIcon({ className }: IconProps) {
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
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

/** A downward tray arrow — the export/download affordance. */
export function DownloadIcon({ className }: IconProps) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

/** An upward tray arrow — the import/upload affordance (mirror of the export
 *  download mark), used by the drag-and-drop overlay and the Import button. */
export function UploadIcon({ className }: IconProps) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 8l5-5 5 5M12 3v12" />
    </svg>
  );
}

// The read-mode field marks. Each read row wears one of these in a tinted
// circle so the card scans at a glance — a handset for phones, an envelope for
// emails, and the small set the details block draws from.

/** A handset — the phone-number rows in read mode (tap to call). */
export function PhoneIcon({ className }: IconProps) {
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
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

/** An envelope — the email rows in read mode (tap to compose). */
export function MailIcon({ className }: IconProps) {
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

/** A briefcase — the company row in read mode. */
export function BuildingIcon({ className }: IconProps) {
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
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/** An "i" in a circle — the details section title in edit mode (company,
 *  website, birthday — the card's miscellaneous facts). */
export function InfoIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

/** A calendar — the birthday row in read mode. */
export function CalendarIcon({ className }: IconProps) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

/** A wrapped gift — the important-date rows (name day, anniversary, …) in read
 *  mode, set apart from the birthday's plain calendar. */
export function GiftIcon({ className }: IconProps) {
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
      <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" />
      <path d="M2 7h20v5H2zM12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

/** A globe — the homepage / website row in read mode (tap to open). */
export function GlobeIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z" />
    </svg>
  );
}

/** A paperclip — the attachments section (files clipped to a card). */
export function PaperclipIcon({ className }: IconProps) {
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
      <path d="M21.4 11.1 12.3 20.2a5 5 0 0 1-7.1-7.1l9.2-9.2a3.3 3.3 0 0 1 4.7 4.7l-9.2 9.2a1.7 1.7 0 0 1-2.4-2.4l8.5-8.5" />
    </svg>
  );
}

/** A document — the row mark for a non-image attachment (a PDF, a doc). */
export function FileIcon({ className }: IconProps) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

/** A map pin — the address row in read mode. */
export function MapPinIcon({ className }: IconProps) {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
