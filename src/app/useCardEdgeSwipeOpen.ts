// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import {
  classifyEdgeDrag,
  inEdgeZone,
  EDGE_OPEN_DISTANCE_PX,
  EDGE_ZONE_PX,
  type MenuButtonSide,
} from "@niclaslindstedt/oss-framework/sidebar";

// The side menu's inward edge swipe, for the one surface the framework's own
// `useEdgeSwipeOpen` deliberately stands down on: an open dialog. That hook
// disarms the moment anything with `aria-modal` is on screen, which is right
// for a settings sheet or a confirmation — but the contact card is a *browse*
// surface here, not a detour. It floats over the list rather than replacing it,
// and picking another contact from the side menu while it is up is a supported
// move (see `onNavigate` in `App.tsx`), so the menu has to stay reachable from
// behind it on a phone.
//
// So this is the framework's gesture, re-armed for exactly that case: the same
// edge strip, the same inward distance, the same "a vertical drag isn't ours"
// rule — all read from the framework's own primitives so the two can't drift —
// with the modal veto replaced by a check that the touch really did land on the
// contact card's own layer. That check is what keeps it from firing under a
// picture cropper, an appearance popover, or anything else portalled on top of
// the card: those land outside the card's wrapper, so the swipe never arms.

/** `aria-labelledby` of the browse-page contact card dialog (see `App.tsx`). */
export const CONTACT_MODAL_LABEL_ID = "contact-modal-title";

export interface CardEdgeSwipeOptions {
  /** Which border the side menu lives on — the strip the swipe starts in. */
  side: MenuButtonSide;
  /** Off unless the contact card is the top surface and the drawer is shut. */
  enabled: boolean;
  /** Open the drawer. */
  onOpen: () => void;
}

/** The contact card modal's outermost layer (card + backdrop), or `null`. */
function cardLayer(): Element | null {
  const card = document.querySelector(
    `[aria-modal="true"][aria-labelledby="${CONTACT_MODAL_LABEL_ID}"]`,
  );
  return card?.parentElement ?? null;
}

/**
 * Open the side menu with an inward swipe from the screen edge while the
 * contact card modal is showing. A no-op whenever `enabled` is false.
 */
export function useCardEdgeSwipeOpen({
  side,
  enabled,
  onOpen,
}: CardEdgeSwipeOptions): void {
  // Read through a ref so the listeners are bound once and still see the
  // current side / enabled flag — the same shape the framework hook uses.
  const cfg = useRef({ side, enabled, onOpen });
  cfg.current = { side, enabled, onOpen };

  useEffect(() => {
    const start = { x: 0, y: 0, armed: false, fired: false };

    const onTouchStart = (e: TouchEvent) => {
      start.armed = false;
      start.fired = false;
      if (!cfg.current.enabled) return;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      // Only the card's own layer: a touch that begins on something stacked
      // over it (the cropper, a popover) belongs to that, not to the menu.
      const layer = cardLayer();
      if (!layer || !(e.target instanceof Node) || !layer.contains(e.target)) {
        return;
      }
      if (
        !inEdgeZone(
          touch.clientX,
          window.innerWidth,
          cfg.current.side,
          EDGE_ZONE_PX,
        )
      ) {
        return;
      }
      start.x = touch.clientX;
      start.y = touch.clientY;
      start.armed = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!start.armed || start.fired) return;
      const touch = e.touches[0];
      if (!touch) return;
      const verdict = classifyEdgeDrag(
        touch.clientX - start.x,
        touch.clientY - start.y,
        cfg.current.side,
        EDGE_OPEN_DISTANCE_PX,
      );
      if (verdict === "press") {
        start.armed = false;
        return;
      }
      if (verdict === "pending") return;
      start.fired = true;
      start.armed = false;
      // Swallow the rest of the drag so the card underneath doesn't also read
      // it (its own swipe-to-dismiss is vertical, but a scroller might).
      if (e.cancelable) e.preventDefault();
      cfg.current.onOpen();
    };

    const onTouchEnd = () => {
      start.armed = false;
      start.fired = false;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);
}
