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
