import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"span"> & {
  tone?: "default" | "pine" | "warn" | "danger" | "board";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "default" && "bg-raised text-muted",
        tone === "pine" && "bg-pine/15 text-pine",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "board" && "bg-board-ink/8 text-board-ink",
        className,
      )}
      {...props}
    />
  );
}
