// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState } from "react";

import {
  Button,
  FloatingPanel,
} from "@niclaslindstedt/oss-framework/components";
import {
  ColorPalette,
  GLYPH_COLORS,
} from "@niclaslindstedt/oss-framework/glyphs";

import { Avatar } from "./Avatar.tsx";
import { ContactGlyphPicker } from "./ContactGlyph.tsx";
import { PersonIcon } from "./icons.tsx";
import { log } from "./log.ts";
import { fileToPhotoDataUri } from "./photo.ts";
import { useT } from "./i18n/index.ts";
import type { Contact } from "./types.ts";

// The card's avatar control in the screen header: a button wearing the
// contact's photo (or glyph / initials), which opens a popover with a photo
// uploader and the framework's glyph + colour pickers. The app owns the
// trigger, the popover chrome (the framework `FloatingPanel`), and *where the
// choice is stored* (the contact store); the framework owns the catalogue,
// the renderer, and the two pickers.
type Props = {
  contact: Contact;
  onChange: (patch: {
    glyph?: string | null;
    color?: string | null;
    photo?: string | null;
  }) => void;
  // The avatar size the trigger wears. The card identity block uses `hero`;
  // callers that want the compact trigger omit it.
  size?: "header" | "hero";
};

export function ContactAppearancePopover({
  contact,
  onChange,
  size = "header",
}: Props) {
  const t = useT();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    try {
      const photo = await fileToPhotoDataUri(file);
      onChange({ photo });
    } catch (err) {
      log.warn(
        `photo: could not read the picked file — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("contact.appearance")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 cursor-pointer rounded-full hover:opacity-80"
      >
        <Avatar contact={contact} size={size} />
      </button>

      <FloatingPanel
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        placement={{
          width: { kind: "min", minPx: 268 },
          anchor: "left",
          gap: 6,
          coordinateSpace: "viewport",
        }}
        className="rounded-md border border-line bg-surface-1 p-3 shadow-lg"
      >
        <div className="mb-3 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {t("contact.uploadPhoto")}
          </Button>
          {contact.photo && (
            <Button variant="ghost" onClick={() => onChange({ photo: null })}>
              {t("contact.removePhoto")}
            </Button>
          )}
        </div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          {t("contact.colour")}
        </p>
        <ColorPalette
          colors={GLYPH_COLORS}
          value={contact.color ?? null}
          onChange={(color) => onChange({ color })}
          ariaLabelPrefix={t("contact.colour")}
        />
        <p className="mt-3 mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          {t("contact.icon")}
        </p>
        <ContactGlyphPicker
          value={contact.glyph ?? null}
          onChange={(glyph) => onChange({ glyph })}
          tintColor={contact.color}
          noneLabel={t("contact.defaultIcon")}
          ariaLabelPrefix={t("contact.icon")}
          defaultIcon={<PersonIcon className="h-3.5 w-3.5" />}
        />
      </FloatingPanel>
    </>
  );
}
