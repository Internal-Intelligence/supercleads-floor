import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CommissionEngine } from "@/components/commission-engine";
import { FloorGate } from "@/components/gate";
import { PayCard } from "@/components/pay-card";
import { Badge } from "@/components/ui/badge";
import { getPayStatement } from "@/lib/floor/server";
import { formatPay } from "@/lib/floor/pay";
import { formatShort } from "@/lib/floor/period";

export const Route = createFileRoute("/pay")({ component: PayPage });

function PayPage() {
  return <FloorGate>{() => <Statement />}</FloorGate>;
}

function Statement() {
  const query = useQuery({
    queryKey: ["pay"],
    queryFn: () => getPayStatement({ data: {} }),
  });

  if (!query.data) return <div className="h-80 animate-pulse rounded-xl bg-surface" />;

  const { pay, target } = query.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
          {target.displayName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pay</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Live statement plus the commission engine. Re-rate, Fast Start, milestones, SPIFs, Clean
          Streak, and 50% chargebacks — same math that prints the 1099.
        </p>
      </div>

      <PayCard pay={pay} />
      <CommissionEngine pay={pay} month={query.data.month} life={query.data.life} />

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">This month’s closes</h2>
          <p className="text-xs text-muted">Each line is re-rated at {(pay.rate * 100).toFixed(0)}%.</p>
        </div>
        {pay.sales.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">
            No closes yet. Post an X and this statement starts at 10%.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pay.sales.map((row, i) => (
              <li key={row.saleId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    #{i + 1} · {row.customerName || "Ownership close"}
                  </p>
                  <p className="text-xs text-muted">
                    {formatShort(row.soldOn)} · {formatPay(row.dealValue)}
                    {row.intelligence ? " · Intel" : ""}
                    {row.painKiller ? " · Pain" : ""}
                    {row.speedClose ? " · Speed" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.refunded ? <Badge tone="danger">Refunded</Badge> : null}
                  <p className="text-sm tabular-nums">{formatPay(row.net)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
