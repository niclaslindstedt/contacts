// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { type ReactNode } from "react";

import {
  SelectPicker,
  type SelectOption,
} from "@niclaslindstedt/oss-framework/components";

import { TagIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { relationLabel } from "./relation.ts";
import {
  activeFilterCount,
  isFilterActive,
  type CardTypeFilter,
  type ContactFilter,
} from "./contactFilter.ts";

// The List view's filter bar — the row of dropdowns the header's filter button
// reveals. Three framework `SelectPicker`s narrow the list to one relationship,
// one tag, and/or one card type (person / company); each leads with an "All"
// entry that clears its facet, and a trailing "Clear" button drops every facet
// at once. The relationship and tag options come from the values actually in
// use across the address book, so a filter never offers something that would
// match nothing.

// A NUL-prefixed sentinel for the "no filter on this facet" option — it can't
// collide with a real relationship value or tag.
const ANY = "\u0000any";

export function ContactListFilters({
  filter,
  relations,
  tags,
  onChange,
}: {
  filter: ContactFilter;
  /** The relationship values in use, in display order (see `relationsInUse`). */
  relations: string[];
  /** Every tag in use, sorted (see `allTags`). */
  tags: string[];
  onChange: (next: ContactFilter) => void;
}) {
  const t = useT();

  // A picked relationship / tag that has since fallen out of use (e.g. its last
  // card was archived while the filter stayed set) still needs an option so the
  // picker can show it, so fold the current value in when it isn't listed.
  const relationValues = withCurrent(relations, filter.relation);
  const tagValues = withCurrent(tags, filter.tag);

  const relationOptions: SelectOption<string>[] = [
    { value: ANY, label: t("list.filter.relationAll") },
    ...relationValues.map((r) => ({ value: r, label: relationLabel(r, t) })),
  ];
  const tagOptions: SelectOption<string>[] = [
    { value: ANY, label: t("list.filter.tagAll") },
    ...tagValues.map((tag) => ({ value: tag, label: tag })),
  ];
  const cardTypeOptions: SelectOption<CardTypeFilter>[] = [
    { value: "all", label: t("list.filter.cardTypeAll") },
    { value: "person", label: t("list.filter.cardTypePrivate") },
    { value: "company", label: t("list.filter.cardTypeBusiness") },
  ];

  const active = isFilterActive(filter);
  // The framework's SelectPicker replaces (not merges) its default trigger
  // classes when `triggerClassName` is given, so spell the whole trigger out —
  // the default, with `bg-surface-1` swapped in so the dropdowns stand out
  // against the bar's own tinted surface.
  const trigger =
    "flex w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-1 px-2.5 py-1.5 text-left text-sm text-fg hover:border-accent focus-visible:border-accent focus-visible:outline-none";

  return (
    <div className="mb-2 rounded-md border border-line bg-surface-2/60 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          <TagIcon className="h-3.5 w-3.5" />
          {t("list.filter.title")}
        </span>
        {active && (
          <button
            type="button"
            onClick={() =>
              onChange({ relation: null, tag: null, cardType: "all" })
            }
            className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            {t("list.filter.clear", { n: String(activeFilterCount(filter)) })}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FilterField label={t("contact.relation")}>
          <SelectPicker<string>
            value={filter.relation ?? ANY}
            options={relationOptions}
            ariaLabel={t("list.filter.relationLabel")}
            triggerClassName={trigger}
            onChange={(next) =>
              onChange({ ...filter, relation: next === ANY ? null : next })
            }
          />
        </FilterField>
        <FilterField label={t("contact.tags")}>
          <SelectPicker<string>
            value={filter.tag ?? ANY}
            options={tagOptions}
            ariaLabel={t("list.filter.tagLabel")}
            triggerClassName={trigger}
            onChange={(next) =>
              onChange({ ...filter, tag: next === ANY ? null : next })
            }
          />
        </FilterField>
        <FilterField label={t("contact.cardType")}>
          <SelectPicker<CardTypeFilter>
            value={filter.cardType}
            options={cardTypeOptions}
            ariaLabel={t("list.filter.cardTypeLabel")}
            triggerClassName={trigger}
            onChange={(cardType) => onChange({ ...filter, cardType })}
          />
        </FilterField>
      </div>
    </div>
  );
}

// One labelled filter control — a small caption above the dropdown, so the row
// of dropdowns reads at a glance which facet each narrows.
function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="px-0.5 text-[0.6875rem] font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Fold a still-selected value into the option list when it has dropped out of
 *  the in-use set, so the picker always has an option matching its value. */
function withCurrent(values: string[], current: string | null): string[] {
  if (current === null) return values;
  if (values.some((v) => v.toLowerCase() === current.toLowerCase())) {
    return values;
  }
  return [...values, current];
}
