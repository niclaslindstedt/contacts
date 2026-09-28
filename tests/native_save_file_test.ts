// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The save-file bridge (`native/src/saveFileBridge.ts`) and the exports that
// use it (`src/app/saveExport.ts`, over the framework's `saveFile`).
//
// Every export in the app — the vCard / CSV / JSON files, a backup `.zip`, a
// reminder `.ics`, an attachment — goes through `saveExport`. In a browser it
// downloads; in the phone app, whose WebView cannot download, the shell's
// `save-file` capability sends it to the share sheet. Both halves are pinned
// here: the contract names against the framework's, and a whole round trip —
// the injected descriptor, the posted request, the injected answer — against
// a stand-in page. `saveFile.ts` (the expo half) stays out of reach of the
// root install, as `icloud.ts` does.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MIME_VCARD,
  MIME_ZIP,
  SAVE_FILE_MESSAGE,
  SAVE_FILE_RESULT_EVENT,
} from "@niclaslindstedt/oss-framework/files";

import {
  SAVE_FILE_DESCRIPTOR,
  SAVE_FILE_RESULT_EVENT as SHELL_RESULT_EVENT,
  SAVE_FILE_TYPE,
  UTI,
  bareName,
  isInPageUrl,
  isSaveFileRequest,
  saveFileResultScript,
} from "../native/src/saveFileBridge.ts";
import { opensInTab } from "../src/app/attachmentView.ts";
import { saveDataUrlExport, saveExport } from "../src/app/saveExport.ts";

/** A stand-in page: a window that is an event target, optionally with the
 *  react-native-webview bridge, and a document whose anchors record clicks. */
function page({ bridge }: { bridge: boolean }) {
  const posted: string[] = [];
  const clicked: { href: string; download: string }[] = [];
  const win = Object.assign(new EventTarget(), {
    ...(bridge
      ? { ReactNativeWebView: { postMessage: (m: string) => posted.push(m) } }
      : {}),
  }) as EventTarget & Record<string, unknown>;
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    createElement: () => {
      const a = {
        href: "",
        download: "",
        rel: "",
        click: () => clicked.push({ href: a.href, download: a.download }),
        remove: () => {},
      };
      return a;
    },
    body: { appendChild: () => {} },
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:page/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return { win, posted, clicked };
}

/** Run an injected script the way the WebView does. */
function inject(script: string) {
  new Function(script)();
}

/** Wait for the page to post its request (the bytes are read first). */
async function nextPost(posted: string[]) {
  await vi.waitFor(() => expect(posted.length).toBeGreaterThan(0));
  const parsed: unknown = JSON.parse(posted[0]!);
  if (!isSaveFileRequest(parsed)) throw new Error("not a save-file request");
  return parsed;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the contract", () => {
  it("speaks the framework's message and event names", () => {
    expect(SAVE_FILE_TYPE).toBe(SAVE_FILE_MESSAGE);
    expect(SHELL_RESULT_EVENT).toBe(SAVE_FILE_RESULT_EVENT);
  });

  it("names a UTI for every type the app exports", () => {
    for (const mime of [
      "text/vcard",
      "text/csv",
      "application/json",
      "application/zip",
      "text/calendar",
      "application/pdf",
    ]) {
      expect(UTI[mime]).toBeTruthy();
    }
  });

  it("keeps only the last path component of a name", () => {
    expect(bareName("../../etc/contacts.vcf")).toBe("contacts.vcf");
    expect(bareName("a\\b.csv")).toBe("b.csv");
    expect(bareName("..")).toBe("file");
    expect(bareName("")).toBe("file");
  });

  it("never follows a blob: or data: URL out of the page", () => {
    expect(isInPageUrl("blob:http://localhost:8241/1")).toBe(true);
    expect(isInPageUrl("DATA:text/plain,x")).toBe(true);
    expect(isInPageUrl("https://example.com/")).toBe(false);
  });
});

describe("an export in a browser", () => {
  it("downloads, as before", async () => {
    const { posted, clicked } = page({ bridge: false });
    await expect(
      saveExport({
        text: "BEGIN:VCARD\r\nEND:VCARD\r\n",
        filename: "contacts.vcf",
        mimeType: MIME_VCARD,
      }),
    ).resolves.toBe("downloaded");
    expect(clicked).toEqual([
      { href: "blob:page/1", download: "contacts.vcf" },
    ]);
    expect(posted).toEqual([]);
  });

  it("downloads in a WebView that has not advertised save-file", async () => {
    // A shell that listens to its page but has no share-sheet half keeps the
    // web behavior rather than posting into the void.
    const { posted, clicked } = page({ bridge: true });
    await saveExport({ text: "x", filename: "contacts.csv" });
    expect(clicked).toHaveLength(1);
    expect(posted).toEqual([]);
  });

  it("opens a PDF attachment in a tab", () => {
    page({ bridge: false });
    expect(opensInTab({ mime: "application/pdf" })).toBe(true);
  });
});

describe("an export in the phone app", () => {
  it("goes to the share sheet and settles when the shell answers", async () => {
    const { posted, clicked } = page({ bridge: true });
    inject(SAVE_FILE_DESCRIPTOR);

    const text = "BEGIN:VCARD\r\nFN:Åsa Öberg\r\nEND:VCARD\r\n";
    const outcome = saveExport({
      text,
      filename: "contacts.vcf",
      mimeType: MIME_VCARD,
    });
    const request = await nextPost(posted);
    expect(request).toMatchObject({
      type: SAVE_FILE_TYPE,
      version: 1,
      filename: "contacts.vcf",
      mimeType: "text/vcard",
    });
    expect(Buffer.from(request.base64, "base64").toString("utf8")).toBe(text);

    inject(saveFileResultScript(request.id, true));
    await expect(outcome).resolves.toBe("shared");
    expect(clicked).toEqual([]);
  });

  it("carries a backup's bytes unchanged", async () => {
    const { posted } = page({ bridge: true });
    inject(SAVE_FILE_DESCRIPTOR);
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00]);
    const outcome = saveExport({
      blob: new Blob([zip], { type: MIME_ZIP }),
      filename: "contacts-backup.zip",
    });
    const request = await nextPost(posted);
    expect(request.mimeType).toBe("application/zip");
    expect([...Buffer.from(request.base64, "base64")]).toEqual([...zip]);
    inject(saveFileResultScript(request.id, true));
    await expect(outcome).resolves.toBe("shared");
  });

  it("reports a failed share without throwing", async () => {
    const { posted } = page({ bridge: true });
    inject(SAVE_FILE_DESCRIPTOR);
    const outcome = saveExport({ text: "a,b", filename: "contacts.csv" });
    const request = await nextPost(posted);
    // An answer for another request is not this one's.
    inject(saveFileResultScript("someone-else", true));
    inject(
      // U+2028 in the message must not break the injected script.
      saveFileResultScript(request.id, false, "Sharing is\u2028not available."),
    );
    await expect(outcome).resolves.toBeNull();
  });

  it("shares an attachment, a PDF included, instead of opening a tab", async () => {
    const { posted } = page({ bridge: true });
    inject(SAVE_FILE_DESCRIPTOR);
    expect(opensInTab({ mime: "application/pdf" })).toBe(false);
    expect(
      saveDataUrlExport(
        "offer.pdf",
        "data:application/pdf;base64,JVBERi0=",
        "application/pdf",
      ),
    ).toBe(true);
    const request = await nextPost(posted);
    expect(request).toMatchObject({
      filename: "offer.pdf",
      mimeType: "application/pdf",
      base64: "JVBERi0=",
    });
  });

  it("merges into a descriptor another script set", () => {
    const { win } = page({ bridge: true });
    win.__ossShell = { version: 1, capabilities: ["something-else"] };
    inject(SAVE_FILE_DESCRIPTOR);
    inject(SAVE_FILE_DESCRIPTOR);
    expect(win.__ossShell).toEqual({
      version: 1,
      capabilities: ["something-else", "save-file"],
    });
  });
});
