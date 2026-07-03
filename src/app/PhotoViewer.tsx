// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CloseIcon } from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";

// Full-screen viewer for a contact's photo: a dim, edge-to-edge overlay showing
// the original at its natural size (capped to the viewport). Opened by tapping
// the avatar in read mode; dismissed with Escape, the close button, a backdrop
// click, or a vertical swipe. Deliberately not the shared `Modal` — a photo
// wants the whole screen, not a bordered card. Trimmed from the `notes`
// `ImageViewer` (this app shows one image, so there's no gallery track).

const DISMISS_DISTANCE = 90;
const AXIS_LOCK = 10;

export function PhotoViewer({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [dragY, setDragY] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "h" | "v">("none");
  const dragged = useRef(false);
  const pointerId = useRef<number | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerId.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = "none";
    dragged.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId || !start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (axis.current === "none") {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not capturable — the drag still tracks via the move events.
      }
    }
    dragged.current = true;
    if (axis.current === "v") setDragY(dy);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    const settled = dragY;
    start.current = null;
    axis.current = "none";
    setDragY(0);
    if (Math.abs(settled) > DISMISS_DISTANCE) onClose();
  };

  // Swallow the click that trails a swipe so a swipe-to-dismiss doesn't also
  // fire the backdrop button.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("contact.viewPhoto")}
      className="fixed inset-0 z-[90] touch-none overflow-hidden bg-black/80 backdrop-blur-sm select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-zoom-out bg-transparent"
      />

      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center p-4 ${
          dragY ? "" : "transition-[transform,opacity] duration-200"
        }`}
        style={{
          transform: `translate3d(0, ${dragY}px, 0)`,
          opacity: dragY ? 1 - Math.min(Math.abs(dragY) / 320, 0.6) : 1,
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-auto max-h-full max-w-full rounded-[var(--radius)] object-contain shadow-2xl"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
