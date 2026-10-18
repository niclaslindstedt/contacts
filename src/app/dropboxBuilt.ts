// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Whether this build carries the Dropbox backend and the local folder at all:
// the website and the desktop app do, the phone app does not.
//
// The phone app (`__NATIVE_BUILD__`) keeps the address book on the device or
// in the reader's own iCloud Drive, and offers neither Dropbox nor a local
// folder — no option in the storage picker, no connect button, no mention. A
// WebView has no directory picker, so the folder could only ever be missing or
// dead there. A phone install that still remembers either as its backend falls
// back to this device (`useSyncEngine.ts`'s `readBackend`), where its working
// copy already is.
//
// Every gate tests `__NATIVE_BUILD__` where it stands rather than reading this
// constant: Vite substitutes the define, and the minifier folds a test written
// in place to a literal the branch then drops on, but keeps a constant
// imported from another module as a variable — which would leave the rows,
// their handlers and the adapters they build in the phone bundle as dead code.
// This export states the answer for the tests (`tests/dropboxBuilt_test.ts`).
export const DROPBOX_BUILT: boolean = !__NATIVE_BUILD__;
