import { cn } from "@/lib/utils";

export function MarkerX({
  className,
  seed = 1,
  fresh = false,
  color,
}: {
  className?: string;
  seed?: number;
  fresh?: boolean;
  color?: string;
}) {
  const tilt = ((seed * 17) % 11) - 5;
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn(!color && "text-marker", fresh && "x-enter", className)}
      style={{ transform: `rotate(${tilt}deg)`, color }}
      aria-hidden
    >
      <path
        d="M7 8 L24 25"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="square"
        className={fresh ? "marker-x" : undefined}
      />
      <path
        d="M24 8 L7 25"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="square"
        className={fresh ? "marker-x" : undefined}
      />
    </svg>
  );
}
