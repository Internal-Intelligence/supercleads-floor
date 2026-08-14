import { MarkerX } from "@/components/marker-x";
import { parseStrokes } from "@/lib/floor/markers";
import { cn } from "@/lib/utils";

export function DrawnX({
  strokeJson,
  color,
  fresh = false,
  className,
}: {
  strokeJson?: string | null;
  color: string;
  fresh?: boolean;
  className?: string;
}) {
  const set = parseStrokes(strokeJson, color);
  if (!set || set.strokes.length === 0) {
    return (
      <span className={cn("grid place-items-center", className)}>
        <MarkerX fresh={fresh} color={color} className="size-full" />
      </span>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className={cn(fresh && "x-enter", className)} aria-hidden>
      {set.strokes.map((stroke, i) => (
        <polyline
          key={i}
          fill="none"
          stroke={set.color || color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={stroke.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
        />
      ))}
    </svg>
  );
}
