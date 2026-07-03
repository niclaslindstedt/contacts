// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CSSProperties, ReactNode } from "react";

import { useGridRovingTabindex } from "@niclaslindstedt/oss-framework/hooks";

import { CONTACT_GLYPH_NAMES, contactGlyphPath } from "./contactGlyphs.ts";
import { PersonIcon } from "./icons.tsx";

// The app-owned twins of the framework's `Glyph` / `GlyphPicker`, drawing from
// the contact-flavoured catalogue (`contactGlyphs.ts`) instead of the neutral
// framework set. The framework versions hard-wire their own path table, so a
// contact-specific mark can only be drawn by rendering it here. The markup and
// classes mirror the framework picker one-for-one (same 8-column radiogroup,
// same roving-tabindex hook) so the popover looks and behaves unchanged — only
// the glyph vocabulary differs.

/** Draw a contact glyph by name; falls back to the neutral person mark when the
 *  name isn't one the catalogue can draw. Matches the framework `Glyph`'s SVG
 *  attributes so app and framework marks render identically. */
export function ContactGlyph({
  name,
  className,
  style,
}: {
  name?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const inner = contactGlyphPath(name);
  if (!inner) return <PersonIcon className={className} />;
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
      style={style}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

/** The contact glyph picker: an 8-column radiogroup with a leading "clear"
 *  cell, keyboard-navigable via the framework's grid roving-tabindex hook. */
export function ContactGlyphPicker({
  value,
  onChange,
  tintColor,
  noneLabel,
  ariaLabelPrefix,
  defaultIcon,
}: {
  /** The selected glyph, or null when none is chosen (the clear cell). */
  value: string | null;
  /** Pick a glyph, or null to clear back to the default. */
  onChange: (glyph: string | null) => void;
  /** Tints the selected cell — the card's accent colour, when set. */
  tintColor?: string | null;
  /** aria-label for the leading "no icon" cell. */
  noneLabel: string;
  /** Per-glyph aria-label prefix, e.g. "Icon" → "Icon heart". */
  ariaLabelPrefix: string;
  /** The icon drawn in the leading "clear" cell. */
  defaultIcon: ReactNode;
}) {
  const glyphs = CONTACT_GLYPH_NAMES;
  const selectedIndex = value === null ? 0 : 1 + glyphs.indexOf(value);
  const { isCursorAt, registerItem, onKeyDown } = useGridRovingTabindex({
    itemCount: glyphs.length + 1,
    columns: 8,
    initialIndex: Math.max(0, selectedIndex),
    active: false,
  });
  const tintStyle = (selected: boolean) =>
    selected && tintColor ? { color: tintColor } : undefined;
  const cellClass = (selected: boolean) =>
    `flex h-7 w-7 cursor-pointer items-center justify-center rounded border ${
      selected && tintColor
        ? "border-current"
        : selected
          ? "border-accent text-accent"
          : "border-line text-muted hover:border-fg"
    }`;

  return (
    <div role="radiogroup" className="grid grid-cols-8 gap-1">
      <button
        ref={registerItem(0)}
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={noneLabel}
        title={noneLabel}
        tabIndex={isCursorAt(0) ? 0 : -1}
        onClick={() => onChange(null)}
        onKeyDown={onKeyDown}
        className={cellClass(value === null)}
        style={tintStyle(value === null)}
      >
        {defaultIcon}
      </button>
      {glyphs.map((name, i) => {
        const selected = name === value;
        const cellIndex = 1 + i;
        return (
          <button
            key={name}
            ref={registerItem(cellIndex)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${ariaLabelPrefix} ${name}`}
            tabIndex={isCursorAt(cellIndex) ? 0 : -1}
            onClick={() => onChange(name)}
            onKeyDown={onKeyDown}
            className={cellClass(selected)}
            style={tintStyle(selected)}
          >
            <ContactGlyph name={name} className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
