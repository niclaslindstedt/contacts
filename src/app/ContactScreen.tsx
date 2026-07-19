// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useState } from "react";

import {
  CheckIcon,
  CopyButton,
  DownloadIcon,
  PencilIcon,
  PullToRefreshIndicator,
} from "@niclaslindstedt/oss-framework/components";
import { downloadText, MIME_VCARD } from "@niclaslindstedt/oss-framework/files";
import { usePullToRefresh } from "@niclaslindstedt/oss-framework/hooks";
import { SyncStatus } from "@niclaslindstedt/oss-framework/sync";
import { unlock } from "@niclaslindstedt/oss-framework/achievements";

import { ContactEditView } from "./ContactEditView.tsx";
import { ContactIdentity } from "./ContactIdentity.tsx";
import { ContactPhotoDropZone } from "./ContactPhotoDropZone.tsx";
import { ContactReadView } from "./ContactReadView.tsx";
import { FavoriteIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { contactToVCard, exportFileStem } from "./export.ts";
import type { ContactStore } from "./useContactStore.ts";
import type { SyncEngine } from "./useSyncEngine.ts";
import { hasAddress } from "./address.ts";
import { hasAttachments } from "./attachments.ts";
import { allTags, contactTags } from "./tags.ts";
import { customRelationsInUse } from "./relation.ts";
import { hasPhoto } from "./contactPhotos.ts";
import { contactStamp } from "./contactTimestamps.ts";
import { isValidFlexDate } from "./importantDates.ts";
import type { AppSettings } from "./useAppSettings.ts";
import type { Contact } from "./types.ts";
import { displayName } from "./types.ts";

// The contact screen — the app's main view. A card opens in read mode: a
// toolbar (edit toggle, copy / vCard-download, sync glyph) over the card body,
// where the avatar and name lead and the information is laid out to be read.
// The toolbar's pencil flips the same card into edit mode, swapping the read
// body for the field form; the check flips it back.
export function ContactScreen({
  store,
  sync,
  settings,
  onOpenSyncDetails,
  pullEnabled = true,
  inModal = false,
}: {
  store: ContactStore;
  // The app's sync engine — drives the header `SyncStatus` glyph.
  sync: SyncEngine;
  // The app settings — the read view formats dates and phone numbers with them.
  settings: AppSettings;
  // Open the framework `SyncDetailsModal` (mounted by the app shell).
  onOpenSyncDetails: () => void;
  // Gate the pull-to-refresh gesture. The shell drops this to false while a
  // sidebar drag owns the pointer or the phone drawer covers the screen — and
  // whenever the card rides inside the swipe-to-dismiss modal, whose own
  // downward gesture would otherwise fight pull-to-refresh.
  pullEnabled?: boolean;
  // True when this card is shown inside the framework `Modal` (opened from the
  // List / Favorites pages). The modal supplies the top safe-area inset and a
  // swipe-down-to-dismiss gesture, so the card drops its own top inset padding
  // and shows a grab handle instead of a back button.
  inModal?: boolean;
}) {
  const { activeContact, updateContact, reload } = store;
  // The relationship picker and tag field suggest values already in use across
  // the whole address book, so a custom relationship or tag added once is
  // reusable on any other card. Derived from the live document, not stored.
  const relations = customRelationsInUse(store.data.contacts);
  const tags = allTags(store.data.contacts);

  // Read/edit mode lives here, above the per-card remount, so switching to
  // another contact keeps you in edit mode instead of dropping back to read —
  // the card you were on is already saved (every field commits on blur, which
  // fires as the tap moves focus away). A brand-new (empty) card still forces
  // edit mode so there's something to fill in.
  const activeId = activeContact?.id;
  const [editing, setEditing] = useState(
    () => !!activeContact && isEmptyContact(activeContact),
  );
  const prevIdRef = useRef(activeId);
  if (activeId !== prevIdRef.current) {
    prevIdRef.current = activeId;
    // Only an empty card overrides the carried-over mode; otherwise the edit /
    // read choice persists across the switch.
    if (activeContact && isEmptyContact(activeContact)) setEditing(true);
  }

  // The pull-to-refresh "sync": re-read the persisted document to pick up
  // edits from another tab. The header `SyncStatus` glyph reflects the *save*
  // lifecycle separately; this is the read side.
  const doPull = useCallback(() => {
    reload();
  }, [reload]);
  const pull = usePullToRefresh(doPull, { enabled: pullEnabled });

  if (!activeContact) return null;

  return (
    // Dropping a photo anywhere on the open card sets its picture (see
    // `ContactPhotoDropZone`) — the container is the drop target and, being
    // `relative`, anchors the drop-zone overlay.
    <ContactPhotoDropZone
      contact={activeContact}
      updateContact={updateContact}
      className={`relative mx-auto flex h-full w-full max-w-2xl flex-col px-4 ${
        inModal ? "pt-3" : "pt-[calc(1.25rem+env(safe-area-inset-top))]"
      }`}
    >
      {/* Grab handle — the swipe-down-to-dismiss affordance the modal offers on
          phones. The modal already supplies the desktop backdrop / Escape exit,
          so this is mobile-only. */}
      {inModal && (
        <div
          aria-hidden="true"
          className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-line sm:hidden"
        />
      )}
      <PullToRefreshIndicator
        state={pull.state}
        pullDistance={pull.pullDistance}
      />
      {/* Key the card by contact id so switching cards remounts it: fresh
          field drafts for the new card. The read/edit mode is held above this
          remount (in `ContactScreen`) so it carries across the switch. */}
      <ContactCard
        key={activeContact.id}
        contact={activeContact}
        editing={editing}
        setEditing={setEditing}
        updateContact={updateContact}
        relations={relations}
        tags={tags}
        sync={sync}
        settings={settings}
        onOpenSyncDetails={onOpenSyncDetails}
      />
    </ContactPhotoDropZone>
  );
}

// A single card: the mode toggle and toolbar, then the identity block and the
// read or edit body. A brand-new (empty) card opens straight in edit mode so
// there is something to fill in; a card with any content opens in read mode.
function ContactCard({
  contact,
  editing,
  setEditing,
  updateContact,
  relations,
  tags,
  sync,
  settings,
  onOpenSyncDetails,
}: {
  contact: Contact;
  editing: boolean;
  setEditing: (next: boolean | ((v: boolean) => boolean)) => void;
  updateContact: (id: string, patch: Partial<Contact>) => void;
  // Relationships / tags already in use — the edit view's picker suggestions.
  relations: string[];
  tags: string[];
  sync: SyncEngine;
  settings: AppSettings;
  onOpenSyncDetails: () => void;
}) {
  const t = useT();

  const exportVCard = () => {
    downloadText(
      `${exportFileStem(contact)}.vcf`,
      `${contactToVCard(contact)}\r\n`,
      MIME_VCARD,
    );
    unlock("exporter");
  };

  return (
    <>
      <header className="mb-2 flex items-center gap-2 border-b border-line px-1 pb-3">
        {/* The read/edit switch. The pencil enters edit mode; the check
            settles the card back to read mode. */}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          title={editing ? t("contact.doneEditing") : t("contact.editContact")}
          aria-label={
            editing ? t("contact.doneEditing") : t("contact.editContact")
          }
          aria-pressed={editing}
          className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border ${
            editing
              ? "border-accent bg-accent/15 text-accent"
              : "border-line text-muted hover:bg-surface-2 hover:text-fg"
          }`}
        >
          {editing ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <PencilIcon className="h-4 w-4" />
          )}
        </button>

        {/* Star this card as a favorite — it gathers on the Favorites page.
            Filled accent heart when starred, a hollow one otherwise. The
            emergency (ICE) flag used to sit beside this; it now lives at the
            bottom of edit mode, where it's set once rather than always on show. */}
        <button
          type="button"
          onClick={() =>
            updateContact(contact.id, { favorite: !contact.favorite })
          }
          aria-pressed={!!contact.favorite}
          title={
            contact.favorite
              ? t("contact.removeFavorite")
              : t("contact.addFavorite")
          }
          aria-label={
            contact.favorite
              ? t("contact.removeFavorite")
              : t("contact.addFavorite")
          }
          className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border ${
            contact.favorite
              ? "border-accent bg-accent/15 text-accent"
              : "border-line text-muted hover:bg-surface-2 hover:text-fg"
          }`}
        >
          <FavoriteIcon className="h-4 w-4" filled={!!contact.favorite} />
        </button>

        <div className="min-w-0 flex-1" />

        {/* Copy the whole card as a vCard block — pasteable anywhere. */}
        <CopyButton
          value={() => contactToVCard(contact)}
          labels={{ copy: t("contact.copyCard"), copied: t("contact.copied") }}
        />
        <button
          type="button"
          onClick={exportVCard}
          title={t("contact.exportVCard")}
          aria-label={t("contact.exportVCard")}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 hover:text-fg"
        >
          <DownloadIcon className="h-4 w-4" />
        </button>
        {/* The framework sync glyph — morphs over the engine's save state and
            opens the command centre on tap. */}
        <SyncStatus
          providerName={sync.providerName}
          status={sync.status}
          dirty={sync.dirty}
          offline={sync.offline}
          onOpenDetails={onOpenSyncDetails}
          labels={{
            saving: t("sync.saving"),
            syncedTo: (n) => t("sync.syncedTo", { name: n }),
            saveUnsaved: t("sync.saveUnsaved"),
            failed: t("sync.failed"),
            throttled: t("sync.throttled"),
            reauthRequired: t("sync.reauthRequired"),
            syncConflict: t("sync.syncConflict"),
            offline: t("sync.offline"),
          }}
        />
      </header>

      {/* `relative` anchors descendant absolutely-positioned nodes to this
          scroller. The framework checkbox hides its real <input> with `sr-only`
          (position: absolute); without a positioning context here it would
          resolve against the non-scrolling card wrapper and render far from its
          glyph, so focusing a checkbox near the bottom yanked the whole card
          off-screen. Anchored to the scroller, the hidden input tracks its
          glyph and focus no longer scrolls an ancestor. */}
      <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-10 [overscroll-behavior:contain]">
        <ContactIdentity
          contact={contact}
          editing={editing}
          updateContact={updateContact}
        />
        {editing ? (
          <ContactEditView
            contact={contact}
            home={settings.country}
            relations={relations}
            tags={tags}
            updateContact={updateContact}
          />
        ) : (
          <ContactReadView
            contact={contact}
            settings={settings}
            onEdit={() => setEditing(true)}
          />
        )}
        <ContactTimestamps contact={contact} settings={settings} />
      </div>
    </>
  );
}

// The discreet foot-of-card date stamp: when the card was added, and — once
// it's been edited on a later day — when it was last modified. Plain
// right-aligned muted text, no section chrome. Renders nothing for a card that
// carries no `createdAt` (a dev-seed card, or one not yet through the v5→v6
// migration).
function ContactTimestamps({
  contact,
  settings,
}: {
  contact: Contact;
  settings: AppSettings;
}) {
  const t = useT();
  const { added, modified } = contactStamp(contact, settings.dateFormat);
  if (!added) return null;
  return (
    <p className="px-1 pt-4 text-right text-xs text-muted">
      {t("contact.addedStamp", { date: added })}
      {modified ? ` ${t("contact.modifiedStamp", { date: modified })}` : ""}
    </p>
  );
}

// A card with nothing on it but its (possibly blank) name and appearance — the
// shape a freshly-created contact has. Such a card opens in edit mode.
function isEmptyContact(c: Contact): boolean {
  return (
    !displayName(c) &&
    c.phones.length === 0 &&
    c.emails.length === 0 &&
    !c.company?.trim() &&
    !c.homepage?.trim() &&
    !c.addresses.some(hasAddress) &&
    !c.relation?.trim() &&
    !c.birthday?.trim() &&
    !c.importantDates.some((d) => isValidFlexDate(d.date)) &&
    contactTags(c).length === 0 &&
    !c.notes?.trim() &&
    !hasPhoto(c) &&
    !hasAttachments(c)
  );
}
