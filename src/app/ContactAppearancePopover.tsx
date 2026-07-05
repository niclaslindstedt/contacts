// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

import {
  CheckIcon,
  FloatingPanel,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";
import {
  ColorPalette,
  GLYPH_COLORS,
  GlyphPicker,
} from "@niclaslindstedt/oss-framework/glyphs";
import {
  ImageCropper,
  readImageSource,
} from "@niclaslindstedt/oss-framework/viewer";

import { Avatar } from "./Avatar.tsx";
import { CONTACT_GLYPH_NAMES, CONTACT_GLYPH_PATHS } from "./contactGlyphs.ts";
import {
  activePhoto,
  photoList,
  withActivePhoto,
  withPhotoAdded,
  withPhotoAdjusted,
  withPhotoRemoved,
} from "./contactPhotos.ts";
import { CropIcon, ImageUpIcon, PersonIcon } from "./icons.tsx";
import { log } from "./log.ts";
import { fromViewTransform, toViewTransform } from "./photo.ts";
import { freshId } from "./useContactStore.ts";
import { useT } from "./i18n/index.ts";
import type { Contact, ContactPhoto, PhotoTransform } from "./types.ts";

// The card's avatar control: a button wearing the contact's photo (or glyph /
// initials) that opens a popover with a **Photos** gallery, then the framework's
// colour and glyph pickers. The gallery is a strip of thumbnails — the current
// face ringed, tap another to swap to it without re-uploading — plus an add tile
// that opens the circle cropper (the framework's `ImageCropper`) on a fresh
// upload, and Adjust / Remove actions on the current photo. The app owns the
// trigger, the popover chrome, and *where the choice is stored* (the contact
// store, via the pure `contactPhotos` mutators); the framework owns the
// renderer, the two pickers, and the cropper — the glyph vocabulary itself
// stays app-side (`contactGlyphs.ts`).

type Props = {
  contact: Contact;
  onChange: (patch: Partial<Contact>) => void;
  // The avatar size the trigger wears. The card identity block uses `hero`;
  // callers that want the compact trigger omit it.
  size?: "header" | "hero";
};

// What the cropper, when open, is framing: a brand-new upload to append, or a
// re-adjust of an existing gallery entry (kept by id so the swap lands back on
// the same photo).
type Cropping = {
  source: string;
  initial: PhotoTransform | null;
  target: { mode: "add" } | { mode: "adjust"; id: string };
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
  const [cropping, setCropping] = useState<Cropping | null>(null);

  const photos = photoList(contact);
  const active = activePhoto(contact);

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    try {
      const source = await readImageSource(file);
      // A fresh upload opens the cropper centred, ready to frame (a null
      // framing is the cropper's cover-fit default). Close the popover first
      // so its dismiss backdrop doesn't sit over the cropper.
      setOpen(false);
      setCropping({
        source,
        initial: null,
        target: { mode: "add" },
      });
    } catch (err) {
      log.warn(
        `photo: could not read the picked file — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function adjust(photo: ContactPhoto) {
    // Re-adjust from the kept original; fall back to the baked crop for a photo
    // that predates the source (or whose source hasn't been fetched offline).
    const source = photo.photoSource || photo.photo;
    if (!source) return;
    setOpen(false);
    setCropping({
      source,
      initial: photo.photoTransform ?? null,
      target: { mode: "adjust", id: photo.id },
    });
  }

  function onCropSaved(photo: string, transform: PhotoTransform) {
    if (!cropping) return;
    if (cropping.target.mode === "adjust") {
      onChange(
        withPhotoAdjusted(contact, cropping.target.id, {
          photo,
          photoSource: cropping.source,
          photoTransform: transform,
          // A re-crop supersedes the filed copy — clear the cloud paths so the
          // next sync re-files the new bytes rather than serving the stale file.
          photoPath: null,
          photoSourcePath: null,
        }),
      );
    } else {
      onChange(
        withPhotoAdded(contact, {
          id: freshId("photo"),
          photo,
          photoSource: cropping.source,
          photoTransform: transform,
        }),
      );
    }
    setCropping(null);
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
          {photos.length > 1 ? t("contact.photos") : t("contact.photo")}
        </p>

        {/* The gallery strip: a thumbnail per photo (the face ringed), then an
            add tile. Tapping a thumbnail makes it the face. */}
        <div className="mb-2 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              active={photo.id === active?.id}
              selectLabel={t("contact.usePhoto")}
              currentLabel={t("contact.currentPhoto")}
              onSelect={() => onChange(withActivePhoto(contact, photo.id))}
            />
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={
              photos.length > 0
                ? t("contact.addPhoto")
                : t("contact.uploadPhoto")
            }
            title={
              photos.length > 0
                ? t("contact.addPhoto")
                : t("contact.uploadPhoto")
            }
            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-line text-muted hover:border-accent hover:text-accent"
          >
            <ImageUpIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Adjust / remove act on the current face. */}
        {active && (
          <div className="mb-3 flex items-center gap-2">
            <PhotoAction
              icon={<CropIcon className="h-4 w-4" />}
              text={t("contact.adjust")}
              label={t("contact.adjustPhoto")}
              onClick={() => adjust(active)}
            />
            <PhotoAction
              icon={<TrashIcon className="h-4 w-4" />}
              text={t("contact.remove")}
              label={t("contact.removePhoto")}
              onClick={() => onChange(withPhotoRemoved(contact, active.id))}
              danger
            />
          </div>
        )}

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
        <GlyphPicker
          glyphs={CONTACT_GLYPH_NAMES}
          paths={CONTACT_GLYPH_PATHS}
          value={contact.glyph ?? null}
          onChange={(glyph) => onChange({ glyph })}
          tintColor={contact.color}
          noneLabel={t("contact.defaultIcon")}
          ariaLabelPrefix={t("contact.icon")}
          defaultIcon={<PersonIcon className="h-3.5 w-3.5" />}
        />
      </FloatingPanel>

      {cropping && (
        <ImageCropper
          source={cropping.source}
          initialTransform={
            cropping.initial ? toViewTransform(cropping.initial) : null
          }
          onCancel={() => setCropping(null)}
          onApply={({ dataUrl, transform }) =>
            onCropSaved(dataUrl, fromViewTransform(transform))
          }
          labels={{
            title: t("contact.cropTitle"),
            hint: t("contact.cropHint"),
            apply: t("contact.savePhoto"),
            cancel: t("common.cancel"),
            zoom: t("contact.zoom"),
          }}
        />
      )}
    </>
  );
}

// One gallery thumbnail: the photo in a circle. The current face wears an accent
// ring and a check badge; the others are tap-to-select. A plain button — the
// per-photo adjust / remove live in the action row, which keeps each thumb a
// single, unambiguous "make this the face" target.
function PhotoThumb({
  photo,
  active,
  selectLabel,
  currentLabel,
  onSelect,
}: {
  photo: ContactPhoto;
  active: boolean;
  selectLabel: string;
  currentLabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={active ? currentLabel : selectLabel}
      title={active ? currentLabel : selectLabel}
      className={`relative h-12 w-12 shrink-0 cursor-pointer rounded-full ${
        active
          ? "ring-2 ring-accent ring-offset-2 ring-offset-surface-1"
          : "opacity-80 hover:opacity-100"
      }`}
    >
      <img
        src={photo.photo ?? ""}
        alt=""
        className="h-full w-full rounded-full object-cover"
      />
      {active && (
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white ring-2 ring-surface-1"
        >
          <CheckIcon className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

// One action button in the Photos section — an icon and a short verb that act
// on the current face. `text` is the compact visible label ("Adjust"); `label`
// is the full accessible name ("Adjust photo") for the tooltip and screen
// readers, so the button reads clearly without spelling out "photo" on screen.
function PhotoAction({
  icon,
  text,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  text: string;
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
      className={`flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line text-sm text-muted hover:bg-surface-2 ${
        danger ? "hover:border-danger/40 hover:text-danger" : "hover:text-fg"
      }`}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}
