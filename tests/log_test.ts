// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { createLogStore } from "@niclaslindstedt/oss-framework/logging";

import { newestFirst } from "../src/app/log.ts";

/** A store with its own keys so the tests never touch the app's buffer. */
function freshStore() {
  const store = createLogStore({
    logsKey: `test:logs:${Math.random()}`,
    captureKey: `test:capture:${Math.random()}`,
  });
  store.setEnabled(true);
  store.setCaptureEnabled(false);
  return store;
}

describe("newestFirst", () => {
  it("hands the buffer back newest-first", () => {
    const store = freshStore();
    const log = store.createLogger("sync");
    log.info("first");
    log.info("second");
    log.info("third");

    expect(store.getLogs().map((e) => e.message)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(
      newestFirst(store)
        .getLogs()
        .map((e) => e.message),
    ).toEqual(["third", "second", "first"]);
  });

  it("leaves the underlying buffer's order untouched", () => {
    const store = freshStore();
    const log = store.createLogger("sync");
    log.info("first");
    log.info("second");

    const view = newestFirst(store);
    view.getLogs();
    view.getLogs();

    expect(store.getLogs().map((e) => e.message)).toEqual(["first", "second"]);
  });

  it("reflects entries logged after the view was built", () => {
    const store = freshStore();
    const view = newestFirst(store);
    const log = store.createLogger("sync");

    log.warn("older");
    log.error("newer");

    expect(view.getLogs().map((e) => e.message)).toEqual(["newer", "older"]);
  });

  it("delegates clearing and the capture / activity gates to the store", () => {
    const store = freshStore();
    const view = newestFirst(store);
    view.createLogger("sync").info("line");
    expect(view.getLogs()).toHaveLength(1);

    view.clearLogs();
    expect(store.getLogs()).toEqual([]);

    view.setCaptureEnabled(true);
    expect(store.isCaptureEnabled()).toBe(true);
    view.setEnabled(false);
    expect(store.isEnabled()).toBe(false);
  });

  it("subscribes through to the store", () => {
    const store = freshStore();
    const view = newestFirst(store);
    let calls = 0;
    const unsubscribe = view.subscribeToLogs(() => {
      calls += 1;
    });

    store.createLogger("sync").info("line");
    expect(calls).toBe(1);

    unsubscribe();
    store.createLogger("sync").info("another");
    expect(calls).toBe(1);
  });
});
