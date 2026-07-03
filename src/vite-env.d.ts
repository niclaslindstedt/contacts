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
