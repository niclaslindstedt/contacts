// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The "What's new" dialog, wrapped so the inlined markdown travels with it.
// `changelog.ts` pulls the whole CHANGELOG plus every `docs/features/*.md`
// into the bundle; keeping both behind this component means that payload
// loads when the dialog is opened rather than on boot.
import { ChangelogModal } from "@niclaslindstedt/oss-framework/changelog";

import { RELEASES, FEATURE_DOCS } from "./changelog.ts";

type Props = Omit<
  Parameters<typeof ChangelogModal>[0],
  "releases" | "featureDocs"
>;

export function ChangelogPanel(props: Props) {
  return (
    <ChangelogModal {...props} releases={RELEASES} featureDocs={FEATURE_DOCS} />
  );
}
