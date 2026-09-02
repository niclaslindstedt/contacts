// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect } from "react";

import {
  guardBlocks,
  guardTouchMove,
  guardTouchStart,
  isNavigationWheel,
  IDLE_GUARD,
  type GuardState,
} from "./swipeNavigation.ts";

// Suppressing the browser's own horizontal navigation gestures — the wiring
// half. `swipeNavigation.ts` holds the rules and explains why they exist; this
// hook only feeds them the real events and cancels what they flag.
//
// Cancelling the *move* rather than the touch that starts it is deliberate: a
// cancelled `touchstart` also swallows the synthetic click, which would leave
// every control within the edge strips untappable. A cancelled `touchmove`
// costs nothing a tap needs.
//
// One engine is out of reach: Android's system back gesture is drawn by the OS
// over the top of the page and never reaches the document, so it keeps working
// whatever the page does. Chrome's *overscroll* flavour of the same navigation
// is already off — `styles.css` locks the document with `overscroll-behavior:
// none`.

/** Whether anything from `target` up to the body scrolls sideways itself. */
function overHorizontalScroller(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    if (node.scrollWidth > node.clientWidth) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Turn off swipe-to-go-back and swipe-to-go-forward for as long as the app is
 * mounted. Nothing else in the app has to know: the guard sits on the document
 * and only ever cancels a gesture the browser would have navigated on, so the
 * drawer's edge swipe, the rows' archive/delete swipes, and every scroll are
 * untouched. Back and Forward stay available through the browser's own
 * controls and the keyboard.
 */
export function useSwipeNavigationGuard(): void {
  useEffect(() => {
    let guard: GuardState = IDLE_GUARD;

    const onTouchStart = (e: TouchEvent) => {
      guard = guardTouchStart(
        Array.from(e.touches),
        window.innerWidth || document.documentElement.clientWidth,
      );
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      guard = guardTouchMove(guard, touch);
      if (guardBlocks(guard) && e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      guard = IDLE_GUARD;
    };

    const onWheel = (e: WheelEvent) => {
      if (!isNavigationWheel(e.deltaX, e.deltaY)) return;
      if (overHorizontalScroller(e.target)) return;
      if (e.cancelable) e.preventDefault();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);
}
