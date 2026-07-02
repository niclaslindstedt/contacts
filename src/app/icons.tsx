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

/** A document with text lines — the Logs surface. */
export function ScrollTextIcon({ className }: IconProps) {
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
      <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
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
