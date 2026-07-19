// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useId, useState } from "react";

import {
  BuildingIcon,
  Button,
  CloseIcon,
  InfoIcon,
  LABELED_FIELD_CLASS,
  Modal,
  PersonIcon,
  PlusIcon,
  Section,
  SegmentedControl,
  SelectPicker,
  type SelectOption,
} from "@niclaslindstedt/oss-framework/components";

import { TagIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { isEmptyMassEdit, type MassEdit } from "./massEdit.ts";
import {
  DEFAULT_RELATIONS,
  isDefaultRelation,
  normalizeRelationInput,
} from "./relation.ts";
import { withTagAdded, withTagRemoved } from "./tags.ts";

// The bulk-edit modal — reached from the "Edit selected" button that appears in
// the List / Favorites header while a multi-select is being made. It gathers
// one set of changes to fan out over every ticked card: tags to add, a
// relationship to set, and the card type (person / company) to switch to. Each
// facet defaults to "leave unchanged", so applying only touches the facets the
// user actually set — a card the edit wouldn't change is left alone (see
// `massEditPatch`), and the whole batch is one undoable store step.
//
// It's the framework's default (non-`centered`) `Modal`: a full-screen sheet on
// mobile and a centred dialog on wider screens, the same chrome the Settings and
// Import modals use, so the bulk editor reads as a first-class screen on a phone
// and a focused dialog on a desktop.

// "Leave this relationship as it is on each card." A NUL-prefixed sentinel can't
// collide with a real relationship value (built-in key or custom label).
const RELATION_KEEP = "\u0000keep";
// Opens the "type a new relationship" input, mirroring the single-card editor.
const RELATION_ADD = "\u0000add";

// Which card type the edit switches every selection to — or leaves untouched.
type CardTypeChoice = "keep" | "person" | "company";

export function MassEditModal({
  open,
  count,
  relations,
  tags,
  onApply,
  onClose,
}: {
  open: boolean;
  /** How many contacts the edit will touch — shown in the title and the apply
   *  button so the reach is explicit. */
  count: number;
  /** Custom relationships already in use across the address book — offered in
   *  the picker below the built-ins, like the single-card editor. */
  relations: string[];
  /** Every tag already in use — the typeahead suggestions the tag field offers. */
  tags: string[];
  onApply: (edit: MassEdit) => void;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const tagListId = useId();

  // The pending edit. `relation === RELATION_KEEP` and `cardType === "keep"`
  // both mean "don't touch this facet"; `addTags` empty means no tags to add.
  const [addTags, setAddTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [relation, setRelation] = useState<string>(RELATION_KEEP);
  const [relationAdding, setRelationAdding] = useState(false);
  const [relationDraft, setRelationDraft] = useState("");
  const [cardType, setCardType] = useState<CardTypeChoice>("keep");

  // Reset the form each time the modal opens, so a fresh selection starts from
  // "nothing chosen" rather than the previous edit's leftovers.
  useEffect(() => {
    if (!open) return;
    setAddTags([]);
    setTagDraft("");
    setRelation(RELATION_KEEP);
    setRelationAdding(false);
    setRelationDraft("");
    setCardType("keep");
  }, [open]);

  const edit: MassEdit = {
    ...(addTags.length > 0 ? { addTags } : {}),
    ...(relation !== RELATION_KEEP ? { relation } : {}),
    ...(cardType !== "keep" ? { isCompany: cardType === "company" } : {}),
  };
  const empty = isEmptyMassEdit(edit);

  const apply = () => {
    if (empty) return;
    onApply(edit);
  };

  // --- Tags -------------------------------------------------------------------
  const addTag = (raw: string) => {
    setTagDraft("");
    const next = withTagAdded(addTags, raw);
    // `withTagAdded` returns the same reference for a blank / duplicate tag.
    if (next !== addTags) setAddTags(next);
  };
  const appliedTags = new Set(addTags.map((x) => x.toLowerCase()));
  const tagSuggestions = tags.filter((k) => !appliedTags.has(k.toLowerCase()));

  // --- Relationship -----------------------------------------------------------
  const current = relation === RELATION_KEEP ? "" : relation.trim();
  // Offer the custom values in use, plus the picked custom value if it isn't
  // among them yet, so the current choice always has a matching option.
  const customs = [...relations];
  if (
    relation !== RELATION_KEEP &&
    current &&
    !isDefaultRelation(current) &&
    !customs.some((c) => c.toLowerCase() === current.toLowerCase())
  ) {
    customs.push(current);
  }
  const relationOptions: SelectOption<string>[] = [
    { value: RELATION_KEEP, label: t("massEdit.leaveUnchanged") },
    { value: "", label: t("contact.relationNone") },
    ...DEFAULT_RELATIONS.map((key) => ({
      value: key as string,
      label: t(`contact.relations.${key}` as Parameters<typeof t>[0]),
    })),
    ...customs.map((c) => ({ value: c, label: c })),
    { value: RELATION_ADD, label: t("contact.relationCustomAdd") },
  ];
  const commitRelationDraft = () => {
    const next = normalizeRelationInput(relationDraft);
    setRelationAdding(false);
    setRelationDraft("");
    // An empty custom draft falls back to "leave unchanged" rather than clearing.
    setRelation(next || RELATION_KEEP);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      closeLabel={t("common.cancel")}
      footer={
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-3 px-4 py-3">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={empty} onClick={apply}>
            {t("massEdit.apply", { n: String(count) })}
          </Button>
        </footer>
      }
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id={titleId}
          className="min-w-0 truncate text-sm font-bold tracking-wide text-fg-bright"
        >
          {t("massEdit.title", { n: String(count) })}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.cancel")}
          className="-mr-1 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        <p className="flex items-start gap-2 px-1 pt-2 pb-1 text-xs text-muted">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("massEdit.hint")}</span>
        </p>

        {/* Tags to add — a chip list over a typeahead field, the same affordance
            the single-card editor uses, but here every committed tag is *added*
            to all the selected cards (a card already carrying it is skipped). */}
        <Section
          icon={<TagIcon className="h-3.5 w-3.5" />}
          title={t("massEdit.addTags")}
        >
          <div className="flex flex-col gap-2">
            {addTags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {addTags.map((tag) => (
                  <li key={tag}>
                    <span className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pr-1 pl-2.5 text-sm text-fg">
                      <span className="[overflow-wrap:anywhere]">{tag}</span>
                      <button
                        type="button"
                        onClick={() => setAddTags(withTagRemoved(addTags, tag))}
                        aria-label={t("contact.removeTag", { tag })}
                        title={t("contact.removeTag", { tag })}
                        className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-1 hover:text-fg"
                      >
                        <PlusIcon className="h-3.5 w-3.5 rotate-45" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <input
              type="text"
              list={tagListId}
              value={tagDraft}
              placeholder={t("contact.tagPlaceholder")}
              aria-label={t("contact.tagAdd")}
              onChange={(e) => setTagDraft(e.target.value)}
              onBlur={() => addTag(tagDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagDraft);
                } else if (
                  e.key === "Backspace" &&
                  !tagDraft &&
                  addTags.length > 0
                ) {
                  setAddTags(
                    withTagRemoved(addTags, addTags[addTags.length - 1]!),
                  );
                }
              }}
              className={LABELED_FIELD_CLASS}
            />
            <datalist id={tagListId}>
              {tagSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </Section>

        {/* Relationship — a picker that leads with "Leave unchanged", then the
            "None" clear entry, the built-ins, any customs in use, and an
            "Add custom…" entry that swaps in a text field. */}
        <Section
          icon={<PersonIcon className="h-3.5 w-3.5" />}
          title={t("massEdit.setRelation")}
        >
          {relationAdding ? (
            <input
              type="text"
              autoFocus
              value={relationDraft}
              placeholder={t("contact.relationCustomPlaceholder")}
              aria-label={t("contact.relationCustomLabel")}
              onChange={(e) => setRelationDraft(e.target.value)}
              onBlur={commitRelationDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setRelationAdding(false);
                  setRelationDraft("");
                }
              }}
              className={LABELED_FIELD_CLASS}
            />
          ) : (
            <SelectPicker<string>
              value={relation}
              options={relationOptions}
              ariaLabel={t("massEdit.setRelation")}
              onChange={(next) => {
                if (next === RELATION_ADD) {
                  setRelationDraft("");
                  setRelationAdding(true);
                } else {
                  setRelation(next);
                }
              }}
            />
          )}
        </Section>

        {/* Card type — leave the cards as they are, or switch them all to person
            or company. Switching to a company drops the person-only fields on
            each card for real, exactly as the single-card switch does. */}
        <Section
          icon={<BuildingIcon className="h-3.5 w-3.5" />}
          title={t("massEdit.setCardType")}
        >
          <div className="flex flex-col gap-2">
            <SegmentedControl<CardTypeChoice>
              value={cardType}
              ariaLabel={t("massEdit.setCardType")}
              fullWidth
              onChange={setCardType}
              options={[
                { value: "keep", label: t("massEdit.leaveUnchanged") },
                { value: "person", label: t("massEdit.person") },
                { value: "company", label: t("massEdit.company") },
              ]}
            />
            {cardType === "company" && (
              <p className="text-xs text-muted">{t("massEdit.companyHint")}</p>
            )}
          </div>
        </Section>
      </div>
    </Modal>
  );
}
