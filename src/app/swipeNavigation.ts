// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Suppressing the browser's own horizontal navigation gestures — the decision
// half.
//
// Every mobile engine turns a horizontal drag that starts on a screen edge into
// history navigation: swipe in from the left edge and it goes *back*, swipe in
// from the right edge and it goes *forward*. Trackpads do the same with a
// two-finger horizontal flick. That is a poor fit for an app whose rows are
// themselves swiped sideways (archive right / delete left) and whose left edge
// is the drawer's own inward-swipe zone: a row swipe that begins a few pixels
// too close to the edge navigates the whole app instead of arming the row, and
// because the router pushes a history entry per card the "back" it lands on is
// a different contact.
//
// So the gestures are switched off. The rules live here as pure functions over
// coordinates — no DOM — so they can be tested directly;
// `useSwipeNavigationGuard.ts` wires them to the real touch and wheel events.

/**
 * How wide (px) the edge strips are that a nav swipe can start in. A little
 * wider than the framework drawer's 30px arming zone so a gesture that arms the
 * drawer is always inside the guarded strip too.
 */
export const EDGE_ZONE = 40;

export type GuardPhase =
  /** Not a candidate — the touch began away from either edge. */
  | "idle"
  /** Started on an edge, but hasn't moved far enough to read as an axis yet. */
  | "watching"
  /** Reads as horizontal: the browser must not see the rest of this gesture. */
  | "blocking"
  /** Reads as vertical: a scroll, and none of the guard's business. */
  | "released";

export type GuardState = {
  phase: GuardPhase;
  /** Where the touch went down, in client coordinates. */
  startX: number;
  startY: number;
};

/** The resting state — nothing is being watched. */
export const IDLE_GUARD: GuardState = { phase: "idle", startX: 0, startY: 0 };

/** A touch point, narrowed to the two fields the rules read. */
export type GuardPoint = { clientX: number; clientY: number };

/**
 * Arm the guard for a touch that just went down. Only a lone finger starting in
 * one of the two edge strips can become a navigation swipe; a pinch, or a touch
 * that lands in the middle of the screen, is left alone.
 */
export function guardTouchStart(
  touches: readonly GuardPoint[],
  viewportWidth: number,
  edgeZone: number = EDGE_ZONE,
): GuardState {
  if (touches.length !== 1) return IDLE_GUARD;
  const touch = touches[0];
  if (!touch) return IDLE_GUARD;
  const onEdge =
    touch.clientX <= edgeZone || touch.clientX >= viewportWidth - edgeZone;
  if (!onEdge) return IDLE_GUARD;
  return { phase: "watching", startX: touch.clientX, startY: touch.clientY };
}

/**
 * Fold a move into the guard. The axis is read once, on the first move that
 * travels at all, and then latched for the rest of the gesture: a horizontal
 * drag blocks (a tie counts as horizontal — that's the gesture being guarded),
 * a vertical one releases for good so the pane underneath scrolls normally.
 *
 * Deciding this early matters. The engine commits to a back/forward swipe
 * within the first pixels of movement, so a guard that waited for a comfortable
 * threshold would already have lost the gesture.
 */
export function guardTouchMove(
  state: GuardState,
  point: GuardPoint,
): GuardState {
  if (state.phase !== "watching") return state;
  const dx = Math.abs(point.clientX - state.startX);
  const dy = Math.abs(point.clientY - state.startY);
  if (dx === 0 && dy === 0) return state;
  return { ...state, phase: dy > dx ? "released" : "blocking" };
}

/** Whether the move that produced this state must be cancelled. */
export function guardBlocks(state: GuardState): boolean {
  return state.phase === "blocking";
}

/**
 * Whether a wheel event is the trackpad's navigation flick rather than a
 * scroll. Desktop engines read a two-finger horizontal swipe as back/forward,
 * so any wheel that travels further sideways than it does vertically is one —
 * unless something under the pointer actually scrolls sideways, which the hook
 * checks before asking.
 */
export function isNavigationWheel(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) > Math.abs(deltaY);
}
