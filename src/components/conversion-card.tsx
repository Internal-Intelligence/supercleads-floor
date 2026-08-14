import type { FunnelStage, RepConversion } from "@/lib/floor/conversion";
import { formatRate } from "@/lib/floor/conversion";
import { cn } from "@/lib/utils";

export function ConversionCard({
  mine,
  floor,
  compact = false,
}: {
  mine: RepConversion;
  floor?: RepConversion;
  compact?: boolean;
}) {
  const rates = compact ? mine.rates.slice(0, 4) : mine.rates;
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Conversion</p>
          <h2 className="mt-1 text-sm font-semibold">This month’s rates</h2>
        </div>
        {floor ? (
          <p className="text-xs text-muted">
            Floor close {formatRate(floor.closeRate)}
          </p>
        ) : null}
      </div>
      <div className={cn("mt-4 grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-5")}>
        {rates.map((rate) => (
          <div key={rate.key} className="rounded-md border border-border px-3 py-2">
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{rate.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{formatRate(rate.pct)}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              {rate.won}/{rate.base || "—"}
            </p>
          </div>
        ))}
      </div>
      <FunnelBar stages={mine.funnel} />
    </section>
  );
}

export function FunnelBar({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ol className="mt-4 grid grid-cols-6 gap-1">
      {stages.map((stage) => (
        <li key={stage.key} className="min-w-0 text-center">
          <div className="flex h-16 items-end rounded-sm bg-raised px-1 pb-1">
            <div
              className="w-full rounded-sm bg-primary/80"
              style={{ height: `${Math.max(stage.count ? 12 : 0, Math.round((stage.count / max) * 100))}%` }}
            />
          </div>
          <p className="mt-1 truncate text-[10px] font-medium tracking-wide text-muted uppercase">{stage.label}</p>
          <p className="text-xs tabular-nums">{stage.count}</p>
        </li>
      ))}
    </ol>
  );
}

export function ConversionTable({
  people,
  meId,
}: {
  people: RepConversion[];
  meId: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Floor conversion</h2>
        <p className="text-xs text-muted">Ranked by close rate. Files touched this period.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-border text-[11px] tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Rep</th>
              <th className="px-4 py-2 font-medium">Close</th>
              <th className="px-4 py-2 font-medium">Lead → X</th>
              <th className="px-4 py-2 font-medium">Demo → X</th>
              <th className="px-4 py-2 font-medium">Connect</th>
              <th className="px-4 py-2 font-medium">Dial → X</th>
              <th className="px-4 py-2 font-medium">Sold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.map((row) => (
              <tr key={row.userId} className={row.userId === meId ? "bg-raised/60" : undefined}>
                <td className="px-4 py-2 font-medium">{row.name}</td>
                <td className="px-4 py-2 tabular-nums">{formatRate(row.closeRate)}</td>
                <td className="px-4 py-2 tabular-nums">{formatRate(row.leadRate)}</td>
                <td className="px-4 py-2 tabular-nums">{formatRate(row.bookRate)}</td>
                <td className="px-4 py-2 tabular-nums">{formatRate(row.connectRate)}</td>
                <td className="px-4 py-2 tabular-nums">{formatRate(row.callCloseRate)}</td>
                <td className="px-4 py-2 tabular-nums">{row.sold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
