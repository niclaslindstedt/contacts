// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The name the app calls itself inside — the privacy page, the page title.
//
// Only the phone build ships under a store listing, so only it takes the
// listing's name, from `APP_DISPLAY_NAME` — the variable `native/identifiers.js`
// gives `expo.name`, so the name inside the app matches the one under its
// icon. The website and the desktop app are the project's own and keep its
// name, and so does a phone build with nothing set: the listing name is
// configuration and is never committed.
//
// `vite.config.ts` resolves it once and folds it in as `__APP_NAME__`; this
// module stays free of that global so the config can import it.

/** The project's own name. Not the listing name — see `APP_DISPLAY_NAME`. */
export const PROJECT_NAME = "Contacts";

export function resolveAppName(
  nativeBuild: boolean,
  displayName: string | undefined,
): string {
  return (nativeBuild && displayName?.trim()) || PROJECT_NAME;
}
