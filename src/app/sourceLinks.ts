// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The links back to the source — the repository, its issues and security
// advisories, the releases page — and the website's own domain. Only the
// website carries them.
//
// The phone app (`__NATIVE_BUILD__`) and the desktop app (`__SHELL_BUILD__`)
// carry no link back to the source and no mention of the website's domain
// (the owner's decision D17 for every native build of a Nird app): no Source
// code row in the About dropdown, no GitHub contact on the privacy page, no
// releases link in What's new. Both flags are compile-time constants Vite
// substitutes, so in those builds the URLs below are literal `null`s and the
// branches that use them are folded out of the bundle rather than hidden. The
// markdown What's new renders (the CHANGELOG, the feature docs) loses its
// source links as it is loaded (`./withoutSourceLinks.ts`, applied by
// `vite.config.ts`). `native/scripts/bundle-web.mjs` and `tauri/scripts/bundle-web.mjs` refuse a
// webroot that still spells the owner's name anywhere (`scripts/website-only.mjs`).

export const SOURCE_LINKS_BUILT: boolean = !(
  __NATIVE_BUILD__ || __SHELL_BUILD__
);

/** The repository — the About dropdown's Source code row. */
export const SOURCE_URL: string | null =
  __NATIVE_BUILD__ || __SHELL_BUILD__
    ? null
    : "https://github.com/niclaslindstedt/contacts";

/** Where the apps send questions and security reports instead — the company
 *  contact apps.agilator.se gives for every app. */
export const SUPPORT_EMAIL = "support@agilator.se";
