import { useMemo, useState } from "react";
import type { Sale } from "@/lib/floor/types";
import type { PayStatement } from "@/lib/floor/pay";
import {
  INTEL_ATTACH,
  OWNERSHIP_PRICE,
  PAIN_KILLER,
  SPEED_CLOSE,
  formatPay,
  projectCloses,
  quoteNextClose,
  salesFromStatement,
} from "@/lib/floor/pay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CommissionEngine({
  pay,
  month,
  life,
}: {
  pay: PayStatement;
  month?: Sale[];
  life?: Sale[];
}) {
  const books = useMemo(() => {
    const m = month ?? salesFromStatement(pay);
    return { month: m, life: life ?? m };
  }, [pay, month, life]);
  const [dealValue, setDealValue] = useState(String(OWNERSHIP_PRICE));
  const [intel, setIntel] = useState(false);
  const [pain, setPain] = useState(false);
  const [speed, setSpeed] = useState(false);
  const [extra, setExtra] = useState(pay.closesToNext ?? 1);

  const value = Number(dealValue);
  const deal = Number.isFinite(value) && value > 0 ? value : OWNERSHIP_PRICE;
  const flags = { dealValue: deal, intelligence: intel, painKiller: pain, speedClose: speed };

  const next = quoteNextClose(books.month, books.life, flags);
  const run = projectCloses(books.month, books.life, extra, flags);

  const parts = [
    { label: `This close · ${(next.rate * 100).toFixed(0)}%`, amount: next.ownBase },
    { label: "Re-rate on earlier X's", amount: next.rerateLift },
    { label: next.milestoneLabel ?? "Milestone", amount: next.milestone },
    { label: "Fast Start", amount: next.fastStart },
    { label: "Tier 5 per-close", amount: next.perClose },
    { label: "Intelligence", amount: next.intelligence },
    { label: "Pain Killer", amount: next.painKiller },
    { label: "Speed Close", amount: next.speedClose },
    { label: "Clean Streak", amount: next.streak },
    { label: "Chargeback", amount: next.chargeback ? -next.chargeback : 0 },
  ].filter((row) => row.amount !== 0);

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
        Commission engine
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">What is the next X worth?</h2>
      <p className="mt-1 text-sm text-muted">
        Official SuperC playbook. Highest tier this month re-rates every close. Flip the SPIFs
        and see the exact dollar.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">Deal</span>
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="decimal"
            value={dealValue}
            onChange={(e) => setDealValue(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <Flag on={intel} onClick={() => setIntel((v) => !v)} label="Intel" hint={`+${INTEL_ATTACH}`} />
          <Flag on={pain} onClick={() => setPain((v) => !v)} label="Pain" hint={`+${PAIN_KILLER}`} />
          <Flag on={speed} onClick={() => setSpeed((v) => !v)} label="Speed" hint={`+${SPEED_CLOSE}`} />
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border px-4 py-3">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
          Close #{next.closeNumber}
          {next.rerates ? " · re-rate" : ""}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{formatPay(next.total)}</p>
        <p className="mt-1 text-sm text-muted">
          Month lands at {formatPay(next.nextNet)} · {(next.rate * 100).toFixed(0)}%
        </p>
      </div>

      {parts.length > 0 ? (
        <ul className="mt-3 divide-y divide-border">
          {parts.map((row) => (
            <li key={row.label} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted">{row.label}</span>
              <span className={cn("tabular-nums", row.amount < 0 && "text-danger")}>
                {row.amount > 0 ? "+" : ""}
                {formatPay(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
              If I close this many more
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ink"
                size="sm"
                className="size-11"
                onClick={() => setExtra((n) => Math.max(1, n - 1))}
              >
                −
              </Button>
              <Input
                type="number"
                min={1}
                max={40}
                className="h-11 w-16 text-center tabular-nums"
                value={extra}
                onChange={(e) => setExtra(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              />
              <Button
                type="button"
                variant="ink"
                size="sm"
                className="size-11"
                onClick={() => setExtra((n) => Math.min(40, n + 1))}
              >
                +
              </Button>
            </div>
          </label>
          <div className="text-right">
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Projected net</p>
            <p className="text-2xl font-semibold tabular-nums">{formatPay(run.endNet)}</p>
            <p className="text-xs text-muted">
              +{formatPay(run.added)} · {run.endCloses} closes · {run.endTier}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Flag({
  on,
  onClick,
  label,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-sm border px-2 text-left text-sm",
        on ? "border-fg bg-raised text-fg" : "border-border text-muted",
      )}
    >
      <span className="block font-medium">{label}</span>
      <span className="block text-[11px]">{hint}</span>
    </button>
  );
}
