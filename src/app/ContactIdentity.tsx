// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { InlineEditField } from "@niclaslindstedt/oss-framework/components";
import { Lightbox } from "@niclaslindstedt/oss-framework/viewer";

import { Avatar } from "./Avatar.tsx";
import { ContactAppearancePopover } from "./ContactAppearancePopover.tsx";
import { activePhotoIndex, hasPhoto, photoList } from "./contactPhotos.ts";
import { useT } from "./i18n/index.ts";
import type { Contact } from "./types.ts";
import { displayName, splitFullName } from "./types.ts";

// The card's face — the avatar and name that used to sit in the screen header,
// now moved down to the top of the card body. It wears both modes: in read
// mode a large static avatar over the name (and company subtitle) centred like
// a contact sheet; in edit mode the same slot holds the appearance popover
// (tap the avatar to restyle) and an inline-editable name.
export function ContactIdentity({
  contact,
  editing,
  updateContact,
}: {
  contact: Contact;
  editing: boolean;
  updateContact: (id: string, patch: Partial<Contact>) => void;
}) {
  const t = useT();
  // Tapping the name in edit mode swaps it for an inline editor (select-all on
  // focus, so the first keystroke replaces the name); this holds that mode.
  const [editingName, setEditingName] = useState(false);
  // Read mode: tapping the photo opens the gallery full-screen. Holds whether
  // the viewer is open; it pages the whole gallery from the active photo.
  const [viewing, setViewing] = useState(false);
  const name = displayName(contact);
  // Each photo shows its original when kept (crisper full-screen), else the
  // baked crop — the srcs the viewer pages through.
  const viewerSrcs = photoList(contact)
    .map((p) => p.photoSource || p.photo)
    .filter((src): src is string => Boolean(src));
  // The company doubles as the display name when a card has no first/last name,
  // so only show it as a subtitle when it is genuinely a second line.
  const showCompany = !!contact.company?.trim() && contact.company !== name;

  return (
    <div className="flex flex-col items-center gap-3 pt-2 pb-6 text-center">
      {editing ? (
        <ContactAppearancePopover
          contact={contact}
          size="hero"
          onChange={(patch) => updateContact(contact.id, patch)}
        />
      ) : hasPhoto(contact) ? (
        <button
          type="button"
          onClick={() => setViewing(true)}
          aria-label={t("contact.viewPhoto")}
          title={t("contact.viewPhoto")}
          className="shrink-0 cursor-zoom-in rounded-full hover:opacity-90"
        >
          <Avatar contact={contact} size="hero" />
        </button>
      ) : (
        <Avatar contact={contact} size="hero" />
      )}

      {viewing && viewerSrcs.length > 0 && (
        <Lightbox
          items={viewerSrcs.map((src) => ({
            render: () => (
              <img
                src={src}
                alt=""
                draggable={false}
                className="max-h-full max-w-full rounded-[var(--radius)] object-contain shadow-2xl"
              />
            ),
          }))}
          initialIndex={activePhotoIndex(contact)}
          onClose={() => setViewing(false)}
          labels={{
            title: t("contact.viewPhoto"),
            close: t("common.close"),
            previous: t("contact.previousPhoto"),
            next: t("contact.nextPhoto"),
            counter: (n, m) =>
              t("contact.photoPosition", { n: String(n), m: String(m) }),
            goTo: (n) => t("contact.showPhotoNumber", { n: String(n) }),
          }}
        />
      )}

      {editing ? (
        editingName ? (
          <h1 className="w-full max-w-xs">
            <InlineEditField
              // A company is one name, not a first/last split — edit the company
              // field directly; a person still splits into first and last.
              initial={contact.isCompany ? (contact.company ?? "") : name}
              ariaLabel={t("contact.renameContact")}
              // Names are proper nouns — hint the on-screen keyboard to
              // capitalise each word.
              inputProps={{ autoCapitalize: "words" }}
              className="w-full border-0 bg-transparent p-0 text-center text-2xl font-bold tracking-wide text-fg-bright outline-none"
              onCommit={(full) => {
                updateContact(
                  contact.id,
                  contact.isCompany
                    ? { company: full.trim() }
                    : splitFullName(full),
                );
                setEditingName(false);
              }}
              onCancel={() => setEditingName(false)}
            />
          </h1>
        ) : (
          <h1 className="w-full max-w-xs">
            <button
              type="button"
              onClick={() => setEditingName(true)}
              title={t("contact.renameContact")}
              className="block w-full truncate text-center text-2xl font-bold tracking-wide text-fg-bright"
            >
              {name || (
                <span className="text-muted">{t("contact.unnamed")}</span>
              )}
            </button>
          </h1>
        )
      ) : (
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <h1 className="max-w-full truncate text-2xl font-bold tracking-wide text-fg-bright">
            {name || <span className="text-muted">{t("contact.unnamed")}</span>}
          </h1>
          {showCompany && (
            <p className="max-w-full truncate text-sm text-muted">
              {contact.company}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
