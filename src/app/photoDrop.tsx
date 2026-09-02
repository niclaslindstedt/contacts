// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

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
import { log } from "./log.ts";
import { fromViewTransform } from "./photo.ts";
import type { Contact } from "./types.ts";
import { freshId } from "./useContactStore.ts";

// Dropping an image onto a contact — the shared half of the two places that
// offer it: the open card (`ContactPhotoDropZone`) and a row of the List /
// Favorites page (`useContactRowPhotoDrop` below). Both read the dropped image,
// open the framework's circle cropper (the same "photo modal" the appearance
// popover uses) so the crop can be framed, and — on apply — append it to that
// contact's gallery *as the face* (`withPhotoAdded`), so the picture is live
// the moment the cropper closes. A drop never replaces an existing photo.
//
// Both zones sit *inside* the address-book `ImportDropZone`, which claims any
// file drag to import contacts. To keep the two from fighting, a photo zone
// only reacts to image drags and claims their events (the framework
// `useFileDrop`'s `claim` mode stops propagation) — so an image becomes a photo
// here while a `.vcf` / CSV / JSON still falls through to import.

/** The gallery fields a drop needs from the contact it lands on. */
export type PhotoDropContact = Pick<Contact, "id" | "photos" | "activePhotoId">;

/** Resolves the card a drop landed on. Called at *apply* time rather than drop
 *  time, so the photo appends to the gallery as it stands when the cropper
 *  closes — and yields undefined for a card that went away meanwhile. */
type ContactLookup = (contactId: string) => PhotoDropContact | undefined;

type CropperOptions = {
  contactFor: ContactLookup;
  updateContact: (id: string, patch: Partial<Contact>) => void;
};

/** The cropper half: `openCropper` reads a dropped image file and raises the
 *  circle cropper on it; `cropper` is the modal to mount (null when closed).
 *  Applying adds the framed picture to the named contact and makes it the face.
 *
 *  An unreadable image is logged and dropped on the floor — a picture that
 *  won't decode is a no-op, not an error worth a dialog. */
export function usePhotoDropCropper({
  contactFor,
  updateContact,
}: CropperOptions): {
  openCropper: (contactId: string, file: File) => void;
  cropper: ReactNode;
} {
  const t = useT();
  // The contact being given a picture and the downscaled image being framed for
  // it, or null while the cropper is closed.
  const [pending, setPending] = useState<{
    contactId: string;
    source: string;
  } | null>(null);

  const openCropper = useCallback((contactId: string, file: File) => {
    void (async () => {
      try {
        setPending({ contactId, source: await readImageSource(file) });
      } catch (err) {
        log.warn(
          `photo: could not read the dropped image — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();
  }, []);

  const cropper = pending ? (
    <ImageCropper
      source={pending.source}
      initialTransform={null}
      onCancel={() => setPending(null)}
      onApply={({ dataUrl, transform }) => {
        const contact = contactFor(pending.contactId);
        if (contact) {
          updateContact(
            contact.id,
            withPhotoAdded(contact, {
              id: freshId("photo"),
              photo: dataUrl,
              photoSource: pending.source,
              photoTransform: fromViewTransform(transform),
            }),
          );
        }
        setPending(null);
      }}
      labels={{
        title: t("contact.cropTitle"),
        hint: t("contact.cropHint"),
        apply: t("contact.savePhoto"),
        cancel: t("common.cancel"),
        zoom: t("contact.zoom"),
      }}
    />
  ) : null;

  return { openCropper, cropper };
}

/** The attribute a contact row wears to say which card a picture dropped on it
 *  belongs to. Rows spell it out literally as `data-photo-drop-id={id}`; the
 *  hook below reads it back off the element under the pointer. */
export const PHOTO_DROP_ATTR = "data-photo-drop-id";

/** Dropping a picture onto one row of a *list* of contacts.
 *
 *  One zone covers the whole list (rather than a drop zone per row, which would
 *  mean a listener set per contact on a page that can hold hundreds): the
 *  container tracks which row the pointer is over from the drag's own target
 *  element, so `targetId` names the card the picture would land on and the list
 *  can light that row up. Releasing over it opens the cropper for that contact;
 *  releasing over a gap — a section header, the empty space past the last row —
 *  hits `onMissedRow` instead, since there's no card to give the photo to. */
export function useContactRowPhotoDrop({
  containerRef,
  contactFor,
  updateContact,
  onMissedRow,
}: CropperOptions & {
  /** The scrolling list element the rows live in. */
  containerRef: RefObject<HTMLElement | null>;
  /** An image was released over the list but not over a contact. */
  onMissedRow?: () => void;
}): {
  /** An image drag is over the list — the moment to hint at what a drop does. */
  active: boolean;
  /** The contact the picture would land on right now, or null over a gap. */
  targetId: string | null;
  /** The cropper modal to mount. */
  cropper: ReactNode;
} {
  const { openCropper, cropper } = usePhotoDropCropper({
    contactFor,
    updateContact,
  });
  const [targetId, setTargetId] = useState<string | null>(null);
  // The drop handler is handed the files, not the event, so the row under the
  // pointer is remembered from the last `dragover` (which always precedes the
  // drop at the same point). A ref alongside the state keeps that read exact
  // rather than a render behind.
  const targetRef = useRef<string | null>(null);
  const setTarget = useCallback((id: string | null) => {
    targetRef.current = id;
    setTargetId(id);
  }, []);

  const { active } = useFileDrop({
    targetRef: containerRef,
    // Only an image drag raises (and claims) this zone; anything else is left
    // to bubble to the enclosing address-book importer.
    accepts: (dt) => dragHasFilesOfType(dt, "image/"),
    claim: true,
    onDrop: (files) => {
      const contactId = targetRef.current;
      setTarget(null);
      const file = firstFileOfType(files, "image/");
      if (!file) return;
      if (contactId) openCropper(contactId, file);
      else onMissedRow?.();
    },
  });

  // Track the hovered row. This listener sits on the same element as the
  // framework hook's own — `claim`'s `stopPropagation` only stops the event
  // reaching *ancestors*, so both still run — and reads the row off the
  // deepest element the drag is over.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => {
      if (!dragHasFilesOfType(e.dataTransfer, "image/")) return;
      const row =
        e.target instanceof Element
          ? e.target.closest(`[${PHOTO_DROP_ATTR}]`)
          : null;
      setTarget(row?.getAttribute(PHOTO_DROP_ATTR) ?? null);
    };
    el.addEventListener("dragover", onDragOver);
    return () => el.removeEventListener("dragover", onDragOver);
  }, [containerRef, setTarget]);

  // Nothing is highlighted once the drag has left the list, whatever row it
  // last crossed.
  return { active, targetId: active ? targetId : null, cropper };
}
