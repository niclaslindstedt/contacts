// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH STATUS-BAR ICONS GO OVER THE PAGE'S BACKGROUND.
//
// **Import-free**, so the root suite can test it without Expo installed.
//
// On iOS the WebView runs edge to edge, so the page's own background is what
// sits under the clock and the battery. `expo-status-bar`'s "auto" does not
// look at that background: it follows the phone's light/dark setting. A dark
// theme on a phone in light mode therefore got dark icons on a dark page, and
// a light theme in dark mode light icons on a light page — both unreadable.
//
// So the style is decided from the colour the page reports
// (`src/injected.ts`), never from the system colour scheme: light icons over
// a dark background, dark icons over a light one. Until the page has reported
// a colour this can read, the answer stays "auto", which is how the wrapper
// behaved before.

/** The values `expo-status-bar`'s `style` prop takes that this can pick. */
export type BarStyle = "light" | "dark" | "auto";

/** Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(...)` or `rgba(...)`
 *  into 0–255 channels. Anything else is null: this does not guess. */
export function parseColour(value: string): [number, number, number] | null {
  const text = value.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    const digits = hex[1]!;
    const pair = (i: number) =>
      digits.length <= 4
        ? parseInt(digits[i]! + digits[i]!, 16)
        : parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    return [pair(0), pair(1), pair(2)];
  }

  const rgb = /^rgba?\(\s*([^)]*)\)$/.exec(text);
  if (rgb) {
    const parts = rgb[1]!
      .split(/[\s,/]+/)
      .filter((part) => part !== "")
      .slice(0, 3)
      .map((part) =>
        part.endsWith("%") ? (parseFloat(part) / 100) * 255 : parseFloat(part),
      );
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      return null;
    }
    const clamp = (n: number) => Math.min(255, Math.max(0, n));
    return [clamp(parts[0]!), clamp(parts[1]!), clamp(parts[2]!)];
  }

  return null;
}

/**
 * The status-bar style for a background: light icons over a dark one, dark
 * icons over a light one, by perceived luminance (Rec. 601 luma). A missing or
 * unreadable colour keeps "auto".
 */
export function barStyleFor(background: string | null | undefined): BarStyle {
  if (typeof background !== "string") return "auto";
  const rgb = parseColour(background);
  if (!rgb) return "auto";
  const luma = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luma < 0.5 ? "light" : "dark";
}
