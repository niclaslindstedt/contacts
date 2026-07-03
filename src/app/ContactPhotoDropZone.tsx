// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState, type ReactNode } from "react";

import { ImageUpIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { PhotoCropper } from "./PhotoCropper.tsx";
import { DEFAULT_TRANSFORM, fileToPhotoSource } from "./photo.ts";
import { dragCarriesImage, firstImageFile } from "./photoDrop.ts";
import { filesFromDataTransfer } from "./importFiles.ts";
import { log } from "./log.ts";
import type { Contact, PhotoTransform } from "./types.ts";
import { displayName } from "./types.ts";

// Drop a photo straight onto the open contact to set its picture — no need to
// enter edit mode or open the appearance popover first. Whenever an *image*
// drag enters the contact card, a dashed "drop zone" overlay invites the drop;
// releasing reads the image and opens the circle cropper (`PhotoCropper`, the
// same "photo modal" the popover uses) so the crop can be framed before it
// lands on the contact.
//
// This zone lives *inside* the address-book `ImportDropZone`, which claims any
// file drag to import contacts. To keep the two from fighting, this zone only
// reacts to image drags and stops their events from bubbling — so an image
// becomes a photo here while a `.vcf`/CSV/JSON still falls through to import.
//
// Like the importer, the overlay is driven by an enter/leave *counter*:
// `dragenter`/`dragleave` fire for every child the pointer crosses, so a bare
// boolean would flicker; counting holds the overlay up until the drag truly
// leaves.

type PhotoPatch = {
  photo: string;
  photoSource: string;
  photoTransform: PhotoTransform;
};

export function ContactPhotoDropZone({
  contact,
  updateContact,
  className,
  children,
}: {
  contact: Contact;
  updateContact: (id: string, patch: PhotoPatch) => void;
  className?: string;
  children: ReactNode;
}) {
  const t = useT();
  const [dragging, setDragging] = useState(false);
  // The downscaled image being framed in the cropper, or null when closed.
  const [cropping, setCropping] = useState<string | null>(null);
  const depth = useRef(0);

  const openCropper = useCallback(async (file: File) => {
    try {
      setCropping(await fileToPhotoSource(file));
    } catch (err) {
      log.warn(
        `photo: could not read the dropped image — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!dragCarriesImage(Array.from(e.dataTransfer.items ?? []))) return;
    // Claim the image drag so the enclosing importer overlay stays down.
    e.preventDefault();
    e.stopPropagation();
    depth.current += 1;
    setDragging(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!dragCarriesImage(Array.from(e.dataTransfer.items ?? []))) return;
    // Signal we accept the drop (without this, the browser opens the image).
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!dragCarriesImage(Array.from(e.dataTransfer.items ?? []))) return;
    e.stopPropagation();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      // A non-image drop is left to bubble to the address-book importer; only
      // an image is claimed here (and kept from the importer) as a photo.
      const file = firstImageFile(filesFromDataTransfer(e.dataTransfer));
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setDragging(false);
      void openCropper(file);
    },
    [openCropper],
  );

  const name = displayName(contact);

  return (
    <div
      className={className}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}

      {dragging && (
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
        <PhotoCropper
          source={cropping}
          initial={DEFAULT_TRANSFORM}
          onCancel={() => setCropping(null)}
          onSave={({ photo, transform }) => {
            updateContact(contact.id, {
              photo,
              photoSource: cropping,
              photoTransform: transform,
            });
            setCropping(null);
          }}
        />
      )}
    </div>
  );
}
