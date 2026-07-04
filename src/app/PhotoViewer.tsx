// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CloseIcon } from "@niclaslindstedt/oss-framework/components";
import { useEscapeKey } from "@niclaslindstedt/oss-framework/hooks";

import { useT } from "./i18n/index.ts";

// Full-screen viewer for a contact's photos: a dim, edge-to-edge overlay showing
// the pictures at their natural size (capped to the viewport). Opened by tapping
// the avatar in read mode; dismissed with Escape, the close button, a backdrop
// click, or a vertical swipe. When the card holds several photos the viewer is a
// horizontal gallery: swipe (or use the arrow keys) to move between them, with a
// count readout and a dot per photo so it's clear how many there are and where
// you are. Deliberately not the shared `Modal` — a photo wants the whole screen,
// not a bordered card.

const DISMISS_DISTANCE = 90;
const AXIS_LOCK = 10;
// A horizontal drag past this fraction of the viewport width flips to the
// neighbouring photo on release; short drags spring back.
const ADVANCE_FRACTION = 0.22;

export function PhotoViewer({
  photos,
  startIndex = 0,
  onClose,
}: {
  /** The photos to page through, largest-available src each (data URIs). */
  photos: string[];
  /** Which photo to open on. */
  startIndex?: number;
  onClose: () => void;
}) {
  const t = useT();

  useEscapeKey(true, onClose);

  const count = photos.length;
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(startIndex, 0), Math.max(count - 1, 0)),
  );
  // Live drag offsets: `dragX` slides the gallery track, `dragY` drives the
  // swipe-to-dismiss fade. Only one is ever non-zero (axis-locked below).
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "h" | "v">("none");
  const dragged = useRef(false);
  const pointerId = useRef<number | null>(null);
  const width = useRef(1);

  const go = (next: number) => {
    setIndex(Math.min(Math.max(next, 0), count - 1));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerId.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    width.current = e.currentTarget.offsetWidth || 1;
    axis.current = "none";
    dragged.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId || !start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (axis.current === "none") {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      // A horizontal swipe pages the gallery only when there's more than one
      // photo; otherwise every drag is a vertical dismiss.
      const horizontal = Math.abs(dx) > Math.abs(dy) && count > 1;
      axis.current = horizontal ? "h" : "v";
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not capturable — the drag still tracks via the move events.
      }
    }
    dragged.current = true;
    if (axis.current === "v") setDragY(dy);
    else if (axis.current === "h") {
      // Resist dragging past the ends so the track feels bounded.
      const atEnd = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
      setDragX(atEnd ? dx * 0.35 : dx);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    const settledY = dragY;
    const settledX = dragX;
    const lockedAxis = axis.current;
    start.current = null;
    axis.current = "none";
    setDragY(0);
    setDragX(0);
    if (lockedAxis === "v" && Math.abs(settledY) > DISMISS_DISTANCE) {
      onClose();
    } else if (lockedAxis === "h") {
      const threshold = width.current * ADVANCE_FRACTION;
      if (settledX <= -threshold) go(index + 1);
      else if (settledX >= threshold) go(index - 1);
    }
  };

  // Swallow the click that trails a swipe so a swipe doesn't also fire the
  // backdrop button.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
  };

  const dimming = dragY ? 1 - Math.min(Math.abs(dragY) / 320, 0.6) : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("contact.viewPhoto")}
      tabIndex={-1}
      onKeyDown={onKeyDown}
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

      {/* The gallery track: all photos laid out in a row, shifted so the current
          one is centred. Vertical dismiss drags the track as a whole. */}
      <div
        className={`pointer-events-none absolute inset-0 flex ${
          dragX || dragY ? "" : "transition-transform duration-200"
        }`}
        style={{
          transform: `translate3d(calc(${-index * 100}% + ${dragX}px), ${dragY}px, 0)`,
          opacity: dimming,
        }}
      >
        {photos.map((src, i) => (
          <div
            key={i}
            className="flex h-full w-full shrink-0 items-center justify-center p-4"
          >
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-auto max-h-full max-w-full rounded-[var(--radius)] object-contain shadow-2xl"
            />
          </div>
        ))}
      </div>

      {/* Count readout + dots — only when there's more than one photo. */}
      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 flex flex-col items-center gap-2">
          <span className="rounded-full bg-black/45 px-2.5 py-0.5 text-xs font-medium text-white/90 tabular-nums">
            {t("contact.photoPosition", {
              n: String(index + 1),
              m: String(count),
            })}
          </span>
          <div className="pointer-events-auto flex items-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={t("contact.showPhotoNumber", { n: String(i + 1) })}
                aria-current={i === index}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === index ? "bg-white" : "bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      )}

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
