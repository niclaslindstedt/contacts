// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

import {
  FloatingPanel,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";
import {
  ColorPalette,
  GLYPH_COLORS,
} from "@niclaslindstedt/oss-framework/glyphs";

import { Avatar } from "./Avatar.tsx";
import { ContactGlyphPicker } from "./ContactGlyph.tsx";
import { CropIcon, ImageUpIcon, PersonIcon } from "./icons.tsx";
import { log } from "./log.ts";
import { PhotoCropper } from "./PhotoCropper.tsx";
import { DEFAULT_TRANSFORM, fileToPhotoSource } from "./photo.ts";
import { useT } from "./i18n/index.ts";
import type { Contact, PhotoTransform } from "./types.ts";

// The card's avatar control: a button wearing the contact's photo (or glyph /
// initials) that opens a popover with a **Photo** section (upload / adjust /
// remove glyphs), then the framework's colour and glyph pickers. Upload and
// Adjust open the circle cropper (`PhotoCropper`); the app owns the trigger,
// the popover chrome, and *where the choice is stored* (the contact store),
// while the framework owns the catalogue, the renderer, and the two pickers.
type PhotoPatch = {
  glyph?: string | null;
  color?: string | null;
  photo?: string | null;
  photoSource?: string | null;
  photoTransform?: PhotoTransform | null;
  photoPath?: string | null;
};

type Props = {
  contact: Contact;
  onChange: (patch: PhotoPatch) => void;
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
  // The image being framed in the cropper (a fresh upload or the existing
  // source for a re-adjust), or null when the cropper is closed.
  const [cropping, setCropping] = useState<{
    source: string;
    initial: PhotoTransform | null;
  } | null>(null);

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    try {
      const source = await fileToPhotoSource(file);
      // A fresh upload opens the cropper centred, ready to frame. Close the
      // popover first so its dismiss backdrop doesn't sit over the cropper.
      setOpen(false);
      setCropping({ source, initial: DEFAULT_TRANSFORM });
    } catch (err) {
      log.warn(
        `photo: could not read the picked file — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function adjust() {
    // Re-adjust from the kept original; fall back to the baked crop for a photo
    // that predates the source (or whose source hasn't been fetched offline).
    const source = contact.photoSource || contact.photo;
    if (!source) return;
    setOpen(false);
    setCropping({ source, initial: contact.photoTransform ?? null });
  }

  function removePhoto() {
    onChange({
      photo: null,
      photoSource: null,
      photoTransform: null,
      photoPath: null,
    });
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

        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          {t("contact.photo")}
        </p>
        <div className="mb-3 flex items-center gap-2">
          <PhotoAction
            icon={<ImageUpIcon className="h-4 w-4" />}
            label={t("contact.uploadPhoto")}
            onClick={() => fileRef.current?.click()}
          />
          {contact.photo && (
            <PhotoAction
              icon={<CropIcon className="h-4 w-4" />}
              label={t("contact.adjustPhoto")}
              onClick={adjust}
            />
          )}
          {contact.photo && (
            <PhotoAction
              icon={<TrashIcon className="h-4 w-4" />}
              label={t("contact.removePhoto")}
              onClick={removePhoto}
              danger
            />
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

      {cropping && (
        <PhotoCropper
          source={cropping.source}
          initial={cropping.initial}
          onCancel={() => setCropping(null)}
          onSave={({ photo, transform }) => {
            onChange({
              photo,
              photoSource: cropping.source,
              photoTransform: transform,
            });
            setCropping(null);
          }}
        />
      )}
    </>
  );
}

// One glyph button in the Photo section — a bordered square wearing an icon,
// with the action's name as its accessible label / tooltip.
function PhotoAction({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 ${
        danger ? "hover:border-danger/40 hover:text-danger" : "hover:text-fg"
      }`}
    >
      {icon}
    </button>
  );
}
