// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { AppData } from "./types.ts";
import { parseDoc } from "./migrations.ts";

// The connect-time reconcile decision: when a cloud backend is first connected
// and it already holds contacts, the local document and the cloud copy can't
// both silently win — one would clobber the other. These pure helpers decide
// whether that collision warrants a prompt and summarise each side so the
// `CloudSetupModal` can show what's at stake ("this device: 12 contacts" vs
// "Dropbox: 40 contacts"). Kept out of `useSyncEngine` so the decision is
// unit-testable without a DOM or a live adapter.

/** A count-only précis of a document, shown beside each choice in the prompt. */
export type CloudDocSummary = { contacts: number; folders: number };

/** Count the contacts and folders a document holds. */
export function summarizeDoc(data: AppData): CloudDocSummary {
  return { contacts: data.contacts.length, folders: data.folders.length };
}

/** Whether two documents carry the same contacts and folders — the active-card
 *  pointer aside, so re-connecting a device that already matches the cloud
 *  never nags. */
function sameContent(a: AppData, b: AppData): boolean {
  return (
    JSON.stringify({ folders: a.folders, contacts: a.contacts }) ===
    JSON.stringify({ folders: b.folders, contacts: b.contacts })
  );
}

/** The state the auto-save gate reads. Kept a plain record (rather than the
 *  live engine) so the decision is unit-testable without a DOM or a live
 *  adapter — see {@link shouldAutoSave}. */
export type AutoSaveGate = {
  /** A remote backend (folder or cloud) is selected — a local-only document
   *  never pushes. */
  isRemote: boolean;
  /** The active remote backend has credentials / a granted handle. */
  connected: boolean;
  /** The working copy holds an edit the backend hasn't got yet. */
  dirty: boolean;
  /** A blocking fault (offline, auth, conflict, throttled) stands in the way. */
  blocked: boolean;
  /** The cloud copy is an encrypted envelope and no passphrase is in memory. */
  locked: boolean;
  /** A connect-time replace-or-adopt prompt is open, holding writes. */
  pendingSetup: boolean;
  /** The mount baseline read has learned the backend's current revision. Until
   *  it has, a push would carry an unknown base revision, which the adapter
   *  rejects as a conflict once a document exists — surfacing a phantom
   *  conflict for an edit made moments after opening (the contacts analog of a
   *  slow cloud read racing a just-made edit). The edit stays safe in the local
   *  working copy meanwhile, and the push follows once the baseline resolves. */
  baselineReady: boolean;
};

/** Whether a settled edit should be pushed to the active remote backend now.
 *  Holds the write while there's no connected remote, a blocking fault or lock,
 *  an open connect-time prompt, or — the race this guards — before the mount
 *  baseline read has established the backend's revision (see
 *  {@link AutoSaveGate.baselineReady}). */
export function shouldAutoSave(gate: AutoSaveGate): boolean {
  return (
    gate.isRemote &&
    gate.connected &&
    gate.dirty &&
    gate.baselineReady &&
    !gate.blocked &&
    !gate.locked &&
    !gate.pendingSetup
  );
}

/** The parsed cloud document when a freshly-connected backend holds contacts
 *  that differ from this device's copy — the signal to raise the
 *  replace-or-adopt prompt. `null` means proceed silently: the cloud is empty,
 *  already matches this device, or the bytes don't parse (nothing to adopt). */
export function evaluateCloudSetup(
  remoteText: string,
  local: AppData,
): AppData | null {
  let remote: AppData;
  try {
    remote = parseDoc(remoteText);
  } catch {
    return null; // Unparseable remote bytes — this device's copy stands.
  }
  if (remote.contacts.length === 0 && remote.folders.length === 0) return null;
  if (sameContent(remote, local)) return null;
  return remote;
}
