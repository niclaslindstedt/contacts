// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState, type ReactNode } from "react";

import { ImageUpIcon } from "@niclaslindstedt/oss-framework/components";
import {
  dragHasFilesOfType,
  firstFileOfType,
  useFileDrop,
} from "@niclaslindstedt/oss-framework/hooks";
import {
  ImageCropper,
  readImageSource,
} from "@niclaslindstedt/oss-framework/viewer";

import { withPhotoAdded } from "./contactPhotos.ts";
import { useT } from "./i18n/index.ts";
import { fromViewTransform } from "./photo.ts";
import { log } from "./log.ts";
import { freshId } from "./useContactStore.ts";
import type { Contact } from "./types.ts";
import { displayName } from "./types.ts";

// Drop a photo straight onto the open contact to add it to the card's gallery
// and make it the face — no need to enter edit mode or open the appearance
// popover first. Whenever an *image* drag enters the contact card, a dashed
// "drop zone" overlay invites the drop; releasing reads the image and opens the
// circle cropper (the framework's `ImageCropper`, the same "photo modal" the
// popover uses) so the crop can be framed before it joins the gallery.
//
// This zone lives *inside* the address-book `ImportDropZone`, which claims any
// file drag to import contacts. To keep the two from fighting, this zone only
// reacts to image drags and claims their events (the framework `useFileDrop`'s
// `claim` mode stops propagation) — so an image becomes a photo here while a
// `.vcf`/CSV/JSON still falls through to import. The hook also owns the
// enter/leave depth counting that keeps the overlay from flickering as the
// pointer crosses child elements.

export function ContactPhotoDropZone({
  contact,
  updateContact,
  className,
  children,
}: {
  contact: Contact;
  updateContact: (id: string, patch: Partial<Contact>) => void;
  className?: string;
  children: ReactNode;
}) {
  const t = useT();
  // The downscaled image being framed in the cropper, or null when closed.
  const [cropping, setCropping] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const openCropper = useCallback(async (file: File) => {
    try {
      setCropping(await readImageSource(file));
    } catch (err) {
      log.warn(
        `photo: could not read the dropped image — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, []);

  const { active } = useFileDrop({
    targetRef: zoneRef,
    // Only an image drag raises (and claims) this zone; anything else is left
    // to bubble to the enclosing address-book importer.
    accepts: (dt) => dragHasFilesOfType(dt, "image/"),
    claim: true,
    onDrop: (files) => {
      const file = firstFileOfType(files, "image/");
      if (file) void openCropper(file);
    },
  });

  const name = displayName(contact);

  return (
    <div ref={zoneRef} className={className}>
      {children}

      {active && (
        <div
          className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-page-bg/85 text-center backdrop-blur-sm"
          aria-hidden
        >
          <ImageUpIcon className="h-10 w-10 text-accent" />
          <div className="px-6">
            <p className="text-base font-semibold text-fg-bright">
              {t("contact.dropPhotoTitle")}
            </p>
            <p className="mt-1 text-sm text-muted">
              {name
                ? t("contact.dropPhotoHintNamed", { name })
                : t("contact.dropPhotoHint")}
            </p>
          </div>
        </div>
      )}

      {cropping && (
        <ImageCropper
          source={cropping}
          initialTransform={null}
          onCancel={() => setCropping(null)}
          onApply={({ dataUrl, transform }) => {
            // A dropped photo joins the gallery and becomes the face — it never
            // replaces an existing picture.
            updateContact(
              contact.id,
              withPhotoAdded(contact, {
                id: freshId("photo"),
                photo: dataUrl,
                photoSource: cropping,
                photoTransform: fromViewTransform(transform),
              }),
            );
            setCropping(null);
          }}
          labels={{
            title: t("contact.cropTitle"),
            hint: t("contact.cropHint"),
            apply: t("contact.savePhoto"),
            cancel: t("common.cancel"),
            zoom: t("contact.zoom"),
          }}
        />
      )}
    </div>
  );
}
