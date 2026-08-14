import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MARKERS,
  type Stroke,
  type StrokeSet,
  emptyStrokes,
  hasDrawnX,
} from "@/lib/floor/markers";
import { haptic } from "@/lib/floor/haptics";
import { cn } from "@/lib/utils";

export function MarkerPad({
  color,
  onColor,
  onChange,
}: {
  color: string;
  onColor: (hex: string) => void;
  onChange: (set: StrokeSet) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);
  const live = useRef<StrokeSet>(emptyStrokes(color));
  const stroke = useRef<Stroke | null>(null);
  const pointer = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  colorRef.current = color;

  function paint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f4faff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c5e0ef";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo((w * i) / 4, 0);
      ctx.lineTo((w * i) / 4, h);
      ctx.moveTo(0, (h * i) / 4);
      ctx.lineTo(w, (h * i) / 4);
      ctx.stroke();
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 14;
    ctx.strokeStyle = live.current.color;
    for (const line of live.current.strokes) {
      if (line.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(line[0].x * w, line[0].y * h);
      for (let i = 1; i < line.length; i += 1) {
        ctx.lineTo(line[i].x * w, line[i].y * h);
      }
      ctx.stroke();
    }
  }

  function commit() {
    const next = {
      color: colorRef.current,
      strokes: live.current.strokes.map((line) => line.slice()),
    };
    live.current = next;
    onChange(next);
    setReady(hasDrawnX(next));
  }

  function lockSheet(on: boolean) {
    const sheet = canvasRef.current?.closest("[data-sheet]");
    if (sheet instanceof HTMLElement) sheet.dataset.drawing = on ? "true" : "false";
    document.body.style.overflow = on ? "hidden" : "";
  }

  useEffect(() => {
    live.current = { ...live.current, color };
    paint();
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pointFrom = (clientX: number, clientY: number) => {
      const box = canvas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (clientX - box.left) / box.width)),
        y: Math.min(1, Math.max(0, (clientY - box.top) / box.height)),
      };
    };

    const start = (id: number, clientX: number, clientY: number) => {
      if (pointer.current != null) return;
      pointer.current = id;
      lockSheet(true);
      haptic("tap");
      const next = pointFrom(clientX, clientY);
      stroke.current = [next];
      live.current = {
        color: colorRef.current,
        strokes: [...live.current.strokes, stroke.current],
      };
      paint();
    };

    const move = (id: number, clientX: number, clientY: number) => {
      if (pointer.current !== id || !stroke.current) return;
      stroke.current.push(pointFrom(clientX, clientY));
      live.current.strokes[live.current.strokes.length - 1] = stroke.current;
      paint();
    };

    const end = (id: number) => {
      if (pointer.current !== id) return;
      pointer.current = null;
      stroke.current = null;
      lockSheet(false);
      commit();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* capture optional */
      }
      start(event.pointerId, event.clientX, event.clientY);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (pointer.current !== event.pointerId) return;
      event.preventDefault();
      move(event.pointerId, event.clientX, event.clientY);
    };
    const onPointerUp = (event: PointerEvent) => {
      event.preventDefault();
      end(event.pointerId);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      event.preventDefault();
      const t = event.touches[0];
      start(t.identifier, t.clientX, t.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!event.touches.length) return;
      event.preventDefault();
      const t = event.touches[0];
      move(t.identifier, t.clientX, t.clientY);
    };
    const onTouchEnd = (event: TouchEvent) => {
      event.preventDefault();
      const t = event.changedTouches[0];
      if (t) end(t.identifier);
    };

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp, { passive: false });
    canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
    const pointerOk = "PointerEvent" in window;
    if (!pointerOk) {
      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd, { passive: false });
      canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
    }
    paint();

    return () => {
      lockSheet(false);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
          Pick a marker
        </p>
        <div className="flex flex-wrap gap-2">
          {MARKERS.map((marker) => (
            <button
              key={marker.id}
              type="button"
              onClick={() => {
                haptic("tick");
                onColor(marker.hex);
              }}
              className={cn(
                "size-11 rounded-full border-2",
                color === marker.hex ? "border-fg" : "border-transparent",
              )}
              style={{ background: marker.hex }}
              aria-label={marker.name}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
          Draw your X
        </p>
        <canvas
          ref={canvasRef}
          width={560}
          height={360}
          className="marker-pad h-52 w-full rounded-md border border-border bg-wb"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {ready
              ? "X is on the pad. Hang it on the board."
              : "One finger. Two strokes. Hold the sheet still."}
          </p>
          <Button
            type="button"
            variant="ink"
            size="sm"
            onClick={() => {
              live.current = emptyStrokes(color);
              paint();
              commit();
            }}
          >
            Wipe
          </Button>
        </div>
      </div>
    </div>
  );
}
