// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Whether this build carries the Dropbox backend at all: the website and the
// desktop app do, the phone app does not.
//
// The phone app (`__NATIVE_BUILD__`) keeps the address book on the device or
// in the reader's own iCloud Drive, and offers no Dropbox — no option in the
// storage picker, no connect button, no mention. The flag is a compile-time
// constant Vite substitutes, so in that build this is a literal `false` and
// every branch it guards is dropped from the bundle rather than hidden. A
// phone install that still remembers Dropbox as its backend falls back to
// this device (`useSyncEngine.ts`'s `readBackend`), where its working copy
// already is.
export const DROPBOX_BUILT: boolean = !__NATIVE_BUILD__;
