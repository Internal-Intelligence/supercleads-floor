import { cn } from "@/lib/utils";

export function SuperCMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-8 place-items-center rounded-sm bg-board text-board-ink">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            d="M7 7 L17 17 M17 7 L7 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="square"
          />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-[15px] font-semibold tracking-tight">
          SuperC
        </span>
        <span className="block text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
          Floor
        </span>
      </span>
    </span>
  );
}

export function SuperCWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      <p className="text-[11px] font-medium tracking-[0.22em] text-muted uppercase">
        SuperC-Leads
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">The Floor</h1>
    </div>
  );
}
