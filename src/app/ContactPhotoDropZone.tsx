// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, type ReactNode } from "react";

import { ImageUpIcon } from "@niclaslindstedt/oss-framework/components";
import {
  dragHasFilesOfType,
  firstFileOfType,
  useFileDrop,
} from "@niclaslindstedt/oss-framework/hooks";

import { useT } from "./i18n/index.ts";
import { usePhotoDropCropper } from "./photoDrop.tsx";
import type { Contact } from "./types.ts";
import { displayName } from "./types.ts";

// Drop a photo straight onto the open contact to add it to the card's gallery
// and make it the face — no need to enter edit mode or open the appearance
// popover first. Whenever an *image* drag enters the contact card, a dashed
// "drop zone" overlay invites the drop; releasing opens the circle cropper so
// the crop can be framed before it joins the gallery. `photoDrop.tsx` owns that
// read / crop / add half — and the same list-page gesture built on it — plus
// the note on how these zones share the drag with the contact importer.
//
// The framework `useFileDrop` owns the enter/leave depth counting that keeps
// the overlay from flickering as the pointer crosses child elements.

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
  const zoneRef = useRef<HTMLDivElement>(null);
  // One card, one possible target: the open contact itself.
  const { openCropper, cropper } = usePhotoDropCropper({
    contactFor: (id) => (id === contact.id ? contact : undefined),
    updateContact,
  });

  const { active } = useFileDrop({
    targetRef: zoneRef,
    // Only an image drag raises (and claims) this zone; anything else is left
    // to bubble to the enclosing address-book importer.
    accepts: (dt) => dragHasFilesOfType(dt, "image/"),
    claim: true,
    onDrop: (files) => {
      const file = firstFileOfType(files, "image/");
      if (file) openCropper(contact.id, file);
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

      {cropper}
    </div>
  );
}
