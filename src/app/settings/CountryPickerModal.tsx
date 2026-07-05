// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The country picker for the Format tab. A flag-and-name list inside the
// framework `Modal`, with a type-ahead field: type "Fin" and Finland floats to
// the top with its matched letters highlighted, and Enter picks it. Choosing a
// country reports it up (the tab stages it like any other draft setting) and
// closes the dialog. The list is app-owned because the country set and its
// localised names live in the app; everything structural — the dialog shell,
// the search field, the close button — comes from the framework.

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CheckIcon,
  ClearableInput,
  Modal,
} from "@niclaslindstedt/oss-framework/components";

import { COUNTRIES, type CountryCode } from "../countries/index.ts";
import { useT } from "../i18n/index.ts";

const TITLE_ID = "country-picker-title";

export function CountryPickerModal({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean;
  current: CountryCode;
  onSelect: (code: CountryCode) => void;
  onClose: () => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // Each open starts from a clean search so the full list is there to browse.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const nameOf = (code: string) =>
    t(
      `settings.format.country.${code.toLowerCase()}` as Parameters<
        typeof t
      >[0],
    );

  // Alphabetical by localised name so the browse order matches what the eye
  // scans for; a query narrows to the countries whose name (or code) contains
  // it, best-ranked first so the top row is the natural Enter target.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...COUNTRIES].sort((a, b) =>
      nameOf(a.code).localeCompare(nameOf(b.code)),
    );
    if (!q) return sorted;
    const scored = sorted
      .map((c) => ({ c, at: nameOf(c.code).toLowerCase().indexOf(q) }))
      .filter(({ c, at }) => at >= 0 || c.code.toLowerCase().startsWith(q));
    // A name that starts with the query outranks one that merely contains it.
    scored.sort((a, b) => (a.at < 0 ? 99 : a.at) - (b.at < 0 ? 99 : b.at));
    return scored.map(({ c }) => c);
    // `nameOf` closes over the stable `t`; re-running on query is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, t]);

  const active = results[0]?.code as CountryCode | undefined;

  const choose = (code: CountryCode) => {
    onSelect(code);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={TITLE_ID}
      initialFocusRef={inputRef}
      closeLabel={t("common.close")}
    >
      <h2 id={TITLE_ID} className="mb-3 text-base font-semibold text-fg-bright">
        {t("settings.format.countryPickerTitle")}
      </h2>

      <ClearableInput
        ref={inputRef}
        value={query}
        onValueChange={setQuery}
        placeholder={t("settings.format.countrySearch")}
        aria-label={t("settings.format.countrySearch")}
        clearLabel={t("common.clear")}
        wrapperClassName="mb-3"
        onKeyDown={(e) => {
          if (e.key === "Enter" && active) {
            e.preventDefault();
            choose(active);
          }
        }}
      />

      {results.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {t("settings.format.countryNoResults", { query: query.trim() })}
        </p>
      ) : (
        <ul
          role="listbox"
          aria-label={t("settings.format.countryPickerTitle")}
          className="-mx-1 max-h-[min(60vh,24rem)] overflow-y-auto"
        >
          {results.map((c) => {
            const selected = c.code === current;
            const highlighted = c.code === active && query.trim().length > 0;
            return (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(c.code as CountryCode)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                    highlighted ? "bg-surface-2" : ""
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {c.flag}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg-bright">
                    <Highlight text={nameOf(c.code)} query={query} />
                  </span>
                  {selected && (
                    <CheckIcon className="h-4 w-4 shrink-0 text-accent" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

// Bold the run of `text` that matches the typed query, so "Fin" lights up the
// "Fin" of Finland. A blank or unmatched query renders the name plain.
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-accent">
        {text.slice(at, at + q.length)}
      </mark>
      {text.slice(at + q.length)}
    </>
  );
}
