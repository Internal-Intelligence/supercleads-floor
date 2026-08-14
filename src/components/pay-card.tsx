import { Link } from "@tanstack/react-router";
import type { PayStatement } from "@/lib/floor/pay";
import { formatPay } from "@/lib/floor/pay";
import { cn } from "@/lib/utils";

export function PayCard({
  pay,
  compact = false,
}: {
  pay: PayStatement;
  compact?: boolean;
}) {
  const progress = pay.nextAt
    ? Math.min(100, Math.round((pay.closes / pay.nextAt) * 100))
    : 100;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
            SuperC-Leads pay
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {formatPay(pay.net)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {pay.closes} close{pay.closes === 1 ? "" : "s"} · {pay.tierName}
            {pay.rate > 0 ? ` · ${(pay.rate * 100).toFixed(0)}%` : ""}
            {pay.perCloseExtra ? " + $250/close" : ""}
          </p>
        </div>
        {compact ? (
          <Link to="/pay" className="text-sm text-muted hover:text-fg">
            Full statement
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{pay.closes === 0 ? "First close starts at 10%" : `Tier ${pay.tierLabel}`}</span>
          <span>
            {pay.closesToNext != null
              ? `${pay.closesToNext} to ${(pay.nextRate! * 100).toFixed(0)}%`
              : "Top tier"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-5 gap-1 text-center text-[11px]">
        {[
          { n: 4, mark: "10%" },
          { n: 8, mark: "14%" },
          { n: 11, mark: "20%" },
          { n: 19, mark: "24%" },
          { n: 20, mark: "35%" },
        ].map((step) => (
          <li
            key={step.n}
            className={cn(
              "rounded-sm py-1.5",
              pay.closes >= (step.n === 20 ? 20 : step.n === 19 ? 12 : step.n === 11 ? 9 : step.n === 8 ? 5 : 1)
                ? "bg-raised text-fg"
                : "text-subtle",
            )}
          >
            {step.mark}
          </li>
        ))}
      </ol>

      {!compact && pay.lines.length > 0 ? (
        <ul className="mt-4 divide-y divide-border">
          {pay.lines.map((line) => (
            <li key={line.key} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted">{line.label}</span>
              <span className={cn("tabular-nums", line.amount < 0 && "text-danger")}>
                {formatPay(line.amount)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between py-2 text-sm font-semibold">
            <span>Net this month</span>
            <span className="tabular-nums">{formatPay(pay.net)}</span>
          </li>
        </ul>
      ) : null}

      {!compact ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Hint
            title="Fast Start"
            ok={pay.fastStartEarned}
            text={pay.fastStartEarned ? "$1,000 locked (first close by the 3rd)" : "Close #1 by the 3rd for $1,000"}
          />
          <Hint
            title="Clean Streak"
            ok={pay.currentStreak >= 5}
            text={`${pay.currentStreak} clean · ${pay.streakToBonus} to the next $500`}
          />
          {pay.milestones.map((m) => (
            <Hint
              key={m.at}
              title={m.label}
              ok={m.hit}
              text={m.hit ? `+${formatPay(m.amount)} paid` : `Close ${m.at} for ${formatPay(m.amount)}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Hint({ title, ok, text }: { title: string; ok: boolean; text: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className={cn("text-[11px] font-medium tracking-wide uppercase", ok ? "text-pine" : "text-muted")}>
        {title}
      </p>
      <p className="mt-0.5 text-xs text-muted">{text}</p>
    </div>
  );
}
