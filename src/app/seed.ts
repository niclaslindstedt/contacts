// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { AppData } from "./types.ts";

// The empty-state starter document a brand-new namespace boots from: no
// folders, one blank card ready to be filled in, so the screen is never
// empty. A green-field app starts empty — there is no demo seed here.
export function starterDoc(): AppData {
  return {
    folders: [],
    contacts: [
      {
        id: "start",
        firstName: "",
        lastName: "",
        phones: [],
        emails: [],
        addresses: [],
        importantDates: [],
        folderId: null,
      },
    ],
    activeContactId: "start",
  };
}
