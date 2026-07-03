// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { Button, SlidersIcon } from "@niclaslindstedt/oss-framework/components";
import { Modal } from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";
import {
  bakeCircleCrop,
  clampTransform,
  DEFAULT_TRANSFORM,
  drawRect,
} from "./photo.ts";
import type { PhotoTransform } from "./types.ts";

// The Facebook-style circle cropper: the source image fills a circular
// viewport, and the user drags to pan and pinches / scrolls / drags the slider
// to zoom, choosing which part the circle exposes. Save bakes the framed region
// to the square display JPEG (`bakeCircleCrop`) and hands back that plus the
// framing so it can be re-adjusted later. The transform is resolution-
// independent (see `photo.ts`), so the on-screen preview and the baked output
// always agree.

const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function PhotoCropper({
  source,
  initial,
  onCancel,
  onSave,
}: {
  /** The source image to frame (a data URI). */
  source: string;
  /** The framing to open at — the last saved transform, or null for centred. */
  initial: PhotoTransform | null;
  onCancel: () => void;
  /** Fired with the baked display crop and the framing that produced it. */
  onSave: (result: { photo: string; transform: PhotoTransform }) => void;
}) {
  const t = useT();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [transform, setTransform] = useState<PhotoTransform>(
    initial ?? DEFAULT_TRANSFORM,
  );
  const [busy, setBusy] = useState(false);

  // Load the source once to learn its natural size (the crop math needs it).
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = source;
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Re-clamp against the source once its size is known, so an opening framing
  // (or one restored from an odd aspect ratio) can't sit off the circle.
  useEffect(() => {
    if (nat) setTransform((tr) => clampTransform(nat.w, nat.h, tr));
  }, [nat]);

  // Keep the drag-to-pan inside the viewport from reaching the enclosing
  // `Modal`'s swipe-down-to-close, which listens for raw touch events on its
  // card. Without this, panning the photo drags the whole modal — the pointer
  // handlers below can't stop it, since swipe-to-close reads `touch*` events
  // rather than pointer ones. Stopping propagation on the viewport (a
  // descendant of the card) runs before the card's bubble-phase listener, so
  // the modal never arms its swipe. Native listeners, because the modal's are
  // native too and would otherwise fire first.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.stopPropagation();
    el.addEventListener("touchstart", stop);
    el.addEventListener("touchmove", stop);
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, []);

  // Live pointer state: the active pointers (for pinch), the last single-pointer
  // position (for incremental pan), and the pinch baseline.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPan = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const viewportSize = () => viewportRef.current?.offsetWidth ?? 1;

  const applyZoom = useCallback(
    (nextScale: number) => {
      setTransform((tr) => {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
        const next = { ...tr, scale };
        return nat ? clampTransform(nat.w, nat.h, next) : next;
      });
    },
    [nat],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      lastPan.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      pinch.current = { dist: pointerDistance(), scale: transform.scale };
      lastPan.current = null;
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const V = viewportSize();

    if (pointers.current.size >= 2 && pinch.current) {
      const ratio = pointerDistance() / (pinch.current.dist || 1);
      applyZoom(pinch.current.scale * ratio);
      return;
    }
    if (pointers.current.size === 1 && lastPan.current && nat) {
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setTransform((tr) =>
        clampTransform(nat.w, nat.h, {
          ...tr,
          x: tr.x + dx / V,
          y: tr.y + dy / V,
        }),
      );
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const [only] = pointers.current.values();
      lastPan.current = only ? { ...only } : null;
    } else if (pointers.current.size === 0) {
      lastPan.current = null;
    }
  };

  function pointerDistance(): number {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  }

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    applyZoom(transform.scale * (e.deltaY < 0 ? 1.08 : 0.92));
  };

  const save = async () => {
    setBusy(true);
    try {
      const photo = await bakeCircleCrop(source, transform);
      onSave({ photo, transform });
    } finally {
      setBusy(false);
    }
  };

  // The image's on-screen rectangle for the current framing, in viewport px.
  const rect = nat
    ? drawRect(nat.w, nat.h, viewportSize(), transform)
    : { x: 0, y: 0, w: 0, h: 0 };

  return (
    <Modal
      open
      onClose={onCancel}
      labelledBy={titleId}
      initialFocusRef={cancelRef}
      closeLabel={t("common.cancel")}
    >
      <div className="flex flex-col gap-4 p-1">
        <h2 id={titleId} className="text-lg font-semibold text-fg-bright">
          {t("contact.cropTitle")}
        </h2>
        <p className="text-sm text-muted">{t("contact.cropHint")}</p>

        {/* The circular viewport. The image sits under a ring + dimmed corners
            so the exposed disc reads as the final crop. */}
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onWheel={onWheel}
          className="relative mx-auto aspect-square w-[min(78vw,20rem)] touch-none overflow-hidden rounded-full border border-line bg-surface-2 select-none"
          style={{ cursor: "grab" }}
        >
          {nat && (
            <img
              src={source}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.w}px`,
                height: `${rect.h}px`,
              }}
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-inset ring-white/60"
          />
        </div>

        {/* Zoom slider — the accessible path to the same zoom as scroll/pinch. */}
        <label className="flex items-center gap-3">
          <SlidersIcon className="h-4 w-4 shrink-0 text-muted" />
          <span className="sr-only">{t("contact.zoom")}</span>
          <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={transform.scale}
            aria-label={t("contact.zoom")}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-accent"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {t("contact.savePhoto")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
