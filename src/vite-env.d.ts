// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/// <reference types="vite/client" />
//
// Vite's ambient client types: `import.meta.env` and the side-effecting asset
// imports (`import "./styles.css"`) both resolve through this.

// The app version, inlined by Vite's `define` (see `vite.config.ts`).
declare const __APP_VERSION__: string;

// The build identifier shown as the "Source code" row's subtitle, composed at
// build time (see `vite.config.ts`): `<version>[.<run>][-<slot>][+<commit>]`.
declare const __BUILD_LABEL__: string;

// Build identity, inlined by Vite's `define` and shown in the Developer tab's
// "Build" grid: the short commit hash of the deployed source, and the CI run
// number ("dev" for a local build).
declare const __BUILD_COMMIT__: string;
declare const __BUILD_NUMBER__: string;

// Build-time env the app reads through `import.meta.env`. All optional — the
// app builds and runs with none of them set. See `docs/configuration.md`.
interface ImportMetaEnv {
  // Boot straight into the developer "Fake data" backend, seeded with sample
  // contacts (see `src/app/dev/fakeData.ts`). `1`/`true`/`sample` loads the
  // curated edge-case set; a number loads roughly that many contacts; `large`
  // loads a big stress-test spread. Unset (or `0`) starts on the real address
  // book. `npm run dev` sets this to `large` by default.
  readonly VITE_SEED?: string;
  // Dropbox app key (PKCE public client). Unset hides the Dropbox storage
  // backend in Settings → Storage. See `src/app/useSyncEngine.ts`.
  readonly VITE_DROPBOX_APP_KEY?: string;
  // Google OAuth client id (GIS token client). Unset hides the Google Drive
  // storage backend. See `src/app/useSyncEngine.ts`.
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
