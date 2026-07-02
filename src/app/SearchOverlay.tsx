// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import {
  Highlighted,
  SearchModal,
} from "@niclaslindstedt/oss-framework/search";
import { ChevronRightIcon } from "@niclaslindstedt/oss-framework/components";
import { unlock } from "@niclaslindstedt/oss-framework/achievements";

import { PersonIcon } from "./icons.tsx";
import { runSearch, type ContactResult, type FieldHit } from "./search.ts";
import { useT } from "./i18n/index.ts";
import type { ContactStore } from "./useContactStore.ts";

// The app's search feature, built over the framework's `SearchModal` +
// matcher. The framework owns the field, the empty/no-results/invalid states,
// and the per-string matching + highlighting; the app owns the corpus
// (`runSearch` groups hits per contact) and the result rows. Picking a result
// selects that contact and dismisses the overlay (and the phone drawer, via
// `onNavigate`).

type Props = {
  open: boolean;
  onClose: () => void;
  store: ContactStore;
  // Close the phone drawer after navigating (a no-op when the sidebar docks).
  onNavigate: () => void;
};

export function SearchOverlay({ open, onClose, store, onNavigate }: Props) {
  const t = useT();
  const data = store.data;

  // Memoise on the document so `SearchModal` keeps a stable `search` ref and
  // doesn't recompute the index every keystroke.
  const search = useCallback((query: string) => runSearch(data, query), [data]);

  return (
    <SearchModal<ContactResult>
      open={open}
      onClose={onClose}
      search={search}
      // Searching is a feature, so it's a trophy. The unlock bus dedupes, so
      // firing on every keystroke records it only once.
      onQueryChange={(q) => {
        if (q) unlock("seeker");
      }}
      labels={{
        title: t("search.title"),
        placeholder: t("search.placeholder"),
        clear: t("search.clear"),
        close: t("common.close"),
        prompt: t("search.prompt"),
        hint: t("search.hint"),
        invalidRegex: t("search.invalidRegex"),
        noResults: (query) => t("search.noResults", { query }),
        matches: (n) =>
          n === 1
            ? t("search.matchesOne")
            : t("search.matchesOther", { n: String(n) }),
      }}
    >
      {(results, close) =>
        results.map((result) => (
          <ResultGroup
            key={result.contactId}
            result={result}
            inContactLabel={t("search.inContact")}
            onSelect={() => {
              store.setActive(result.contactId);
              onNavigate();
              close();
            }}
          />
        ))
      }
    </SearchModal>
  );
}

// One contact's group: a header row (the person icon + the name, highlighted
// if it matched) followed by the matched fields. The whole group navigates to
// the contact.
function ResultGroup({
  result,
  inContactLabel,
  onSelect,
}: {
  result: ContactResult;
  inContactLabel: string;
  onSelect: () => void;
}) {
  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
      >
        <span className="text-accent">
          <PersonIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-bright">
          {result.titleRanges ? (
            <Highlighted text={result.title} ranges={result.titleRanges} />
          ) : (
            result.title
          )}
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {result.fields.map((field) => (
        <FieldRow key={field.key} field={field} onSelect={onSelect} />
      ))}
      {result.fields.length === 0 && result.titleRanges && (
        <p className="py-1.5 pr-4 pl-12 text-xs text-muted">{inContactLabel}</p>
      )}
    </li>
  );
}

function FieldRow({
  field,
  onSelect,
}: {
  field: FieldHit;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-start gap-2 py-1.5 pr-4 pl-12 text-left hover:bg-surface-2"
    >
      <span className="mt-1 shrink-0 text-muted">
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 text-sm text-fg">
        <Highlighted text={field.text} ranges={field.ranges} />
      </span>
    </button>
  );
}
