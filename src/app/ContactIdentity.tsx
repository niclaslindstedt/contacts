// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useLayoutEffect, useRef, useState } from "react";

import { InlineEditField } from "@niclaslindstedt/oss-framework/components";

import { Avatar } from "./Avatar.tsx";
import { ContactAppearancePopover } from "./ContactAppearancePopover.tsx";
import { PhotoViewer } from "./PhotoViewer.tsx";
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
  // The framework's InlineEditField renders a bare <input> with no
  // autocapitalize hint. Names are proper nouns, so tell the on-screen keyboard
  // to capitalise each word. Set it here, in a layout effect, so the attribute
  // lands before InlineEditField's own focus effect opens the keyboard.
  const nameEditRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (!editingName) return;
    const input = nameEditRef.current?.querySelector("input");
    input?.setAttribute("autocapitalize", "words");
  }, [editingName]);
  // Read mode: tapping the photo opens it full-screen. Holds the shown source
  // (the original when kept, else the baked crop), or null when closed.
  const [viewing, setViewing] = useState<string | null>(null);
  const name = displayName(contact);
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
      ) : contact.photo ? (
        <button
          type="button"
          onClick={() =>
            setViewing(contact.photoSource || contact.photo || null)
          }
          aria-label={t("contact.viewPhoto")}
          title={t("contact.viewPhoto")}
          className="shrink-0 cursor-zoom-in rounded-full hover:opacity-90"
        >
          <Avatar contact={contact} size="hero" />
        </button>
      ) : (
        <Avatar contact={contact} size="hero" />
      )}

      {viewing && (
        <PhotoViewer src={viewing} onClose={() => setViewing(null)} />
      )}

      {editing ? (
        editingName ? (
          <h1 className="w-full max-w-xs" ref={nameEditRef}>
            <InlineEditField
              initial={name}
              ariaLabel={t("contact.renameContact")}
              className="w-full border-0 bg-transparent p-0 text-center text-2xl font-bold tracking-wide text-fg-bright outline-none"
              onCommit={(full) => {
                updateContact(contact.id, splitFullName(full));
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
