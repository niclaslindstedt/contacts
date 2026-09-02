import { describe, expect, it } from "vitest";

import {
  EDGE_ZONE,
  IDLE_GUARD,
  guardBlocks,
  guardTouchMove,
  guardTouchStart,
  isNavigationWheel,
  type GuardPoint,
} from "../src/app/swipeNavigation.ts";

const WIDTH = 400;

const at = (clientX: number, clientY: number): GuardPoint => ({
  clientX,
  clientY,
});

/** Play a whole gesture through the guard and report every move's verdict. */
function play(
  touches: readonly GuardPoint[],
  moves: readonly GuardPoint[],
): boolean[] {
  let state = guardTouchStart(touches, WIDTH);
  return moves.map((point) => {
    state = guardTouchMove(state, point);
    return guardBlocks(state);
  });
}

describe("guardTouchStart", () => {
  it("arms on the left edge — where a swipe means Back", () => {
    expect(guardTouchStart([at(0, 100)], WIDTH).phase).toBe("watching");
    expect(guardTouchStart([at(EDGE_ZONE, 100)], WIDTH).phase).toBe("watching");
  });

  it("arms on the right edge — where a swipe means Forward", () => {
    expect(guardTouchStart([at(WIDTH, 100)], WIDTH).phase).toBe("watching");
    expect(guardTouchStart([at(WIDTH - EDGE_ZONE, 100)], WIDTH).phase).toBe(
      "watching",
    );
  });

  it("leaves touches that start away from either edge alone", () => {
    expect(guardTouchStart([at(EDGE_ZONE + 1, 100)], WIDTH).phase).toBe("idle");
    expect(guardTouchStart([at(WIDTH / 2, 100)], WIDTH).phase).toBe("idle");
    expect(guardTouchStart([at(WIDTH - EDGE_ZONE - 1, 100)], WIDTH).phase).toBe(
      "idle",
    );
  });

  it("ignores multi-touch — a pinch is not a navigation swipe", () => {
    expect(guardTouchStart([at(2, 100), at(6, 140)], WIDTH)).toEqual(
      IDLE_GUARD,
    );
    expect(guardTouchStart([], WIDTH)).toEqual(IDLE_GUARD);
  });

  it("records where the gesture began", () => {
    expect(guardTouchStart([at(4, 120)], WIDTH)).toEqual({
      phase: "watching",
      startX: 4,
      startY: 120,
    });
  });

  it("honours a caller-supplied edge width", () => {
    expect(guardTouchStart([at(20, 100)], WIDTH, 10).phase).toBe("idle");
    expect(guardTouchStart([at(20, 100)], WIDTH, 25).phase).toBe("watching");
  });
});

describe("guardTouchMove", () => {
  it("blocks an inward drag from the left edge (Back)", () => {
    expect(play([at(3, 200)], [at(9, 201), at(60, 205), at(140, 210)])).toEqual(
      [true, true, true],
    );
  });

  it("blocks an inward drag from the right edge (Forward)", () => {
    expect(
      play([at(WIDTH - 3, 200)], [at(WIDTH - 12, 202), at(WIDTH - 90, 204)]),
    ).toEqual([true, true]);
  });

  it("blocks an outward drag too — a row swipe near an edge still counts", () => {
    expect(play([at(5, 200)], [at(1, 200), at(0, 201)])).toEqual([true, true]);
  });

  it("releases a vertical drag so the pane underneath scrolls", () => {
    expect(play([at(5, 200)], [at(6, 212), at(8, 260), at(30, 300)])).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("stays watching until the finger actually travels", () => {
    const armed = guardTouchStart([at(5, 200)], WIDTH);
    expect(guardTouchMove(armed, at(5, 200)).phase).toBe("watching");
  });

  it("reads a tie as horizontal — that is the gesture being guarded", () => {
    expect(play([at(5, 200)], [at(9, 204)])).toEqual([true]);
  });

  it("latches its verdict for the rest of the gesture", () => {
    // A drag that starts sideways keeps blocking even once it curls downward…
    expect(play([at(5, 200)], [at(15, 201), at(20, 400)])).toEqual([
      true,
      true,
    ]);
    // …and one that starts as a scroll never starts blocking.
    expect(play([at(5, 200)], [at(6, 240), at(300, 245)])).toEqual([
      false,
      false,
    ]);
  });

  it("never blocks a gesture that began away from an edge", () => {
    expect(play([at(200, 200)], [at(260, 201), at(340, 202)])).toEqual([
      false,
      false,
    ]);
  });
});

describe("isNavigationWheel", () => {
  it("treats a sideways-dominant wheel as the trackpad's nav flick", () => {
    expect(isNavigationWheel(-40, 0)).toBe(true);
    expect(isNavigationWheel(30, 4)).toBe(true);
  });

  it("leaves scrolling alone", () => {
    expect(isNavigationWheel(0, 40)).toBe(false);
    expect(isNavigationWheel(4, 30)).toBe(false);
    expect(isNavigationWheel(12, 12)).toBe(false);
    expect(isNavigationWheel(0, 0)).toBe(false);
  });
});
