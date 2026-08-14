import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CallDialog } from "@/components/call-dialog";
import { ConversionCard } from "@/components/conversion-card";
import { FloorGate } from "@/components/gate";
import { PayCard } from "@/components/pay-card";
import { SaleDialog } from "@/components/sale-dialog";
import { Button } from "@/components/ui/button";
import { getConversion, getMyDay, getPayStatement, logCall, postSale, updateMyProfile } from "@/lib/floor/server";
import { getDesk } from "@/lib/floor/desk-server";
import { buildChecklist } from "@/lib/floor/desk";
import { formatMoney, formatShort, OUTCOME_LABEL, todayIso } from "@/lib/floor/period";
import { formatPay } from "@/lib/floor/pay";
import { tickBoard } from "@/lib/floor/sound";
import { haptic } from "@/lib/floor/haptics";
import type { Customer, PersonColumn, SaleInput } from "@/lib/floor/types";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  return <FloorGate>{() => <DayView />}</FloorGate>;
}

function DayView() {
  const queryClient = useQueryClient();
  const day = useQuery({ queryKey: ["day"], queryFn: () => getMyDay() });
  const pay = useQuery({ queryKey: ["pay"], queryFn: () => getPayStatement({ data: {} }) });
  const conv = useQuery({ queryKey: ["conversion"], queryFn: () => getConversion({ data: { period: "month" } }) });
  const desk = useQuery({ queryKey: ["desk"], queryFn: () => getDesk() });
  const [saleOpen, setSaleOpen] = useState(false);
  const [callFor, setCallFor] = useState<Customer | "new" | null>(null);
  const [name, setName] = useState("");
  const [goalDraft, setGoalDraft] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["day"] });
    void queryClient.invalidateQueries({ queryKey: ["floor"] });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["conversion"] });
  };

  const saleMut = useMutation({
    mutationFn: (input: SaleInput) =>
      postSale({
        data: {
          customerName: input.customerName,
          dealValue: input.dealValue,
          notes: input.notes,
          soldOn: input.soldOn || todayIso(),
          intelligence: input.intelligence,
          painKiller: input.painKiller,
          speedClose: input.speedClose,
          firstDemoOn: input.firstDemoOn,
          markerColor: input.markerColor,
          strokeJson: input.strokeJson,
        },
      }),
    onSuccess: (result) => {
      tickBoard();
      toast.success(`X on the board · ${formatPay(result.quote.total)}`);
      setSaleOpen(false);
      invalidate();
    },
    onError: (err) => {
      haptic("error");
      toast.error(err.message);
    },
  });

  const callMut = useMutation({
    mutationFn: (input: {
      customerName: string;
      outcome: "connected" | "voicemail" | "no_answer" | "booked" | "sold" | "not_interested";
      notes: string;
      nextFollowUp: string;
      status: "new" | "contacted" | "follow_up" | "booked" | "sold" | "dead";
    }) =>
      logCall({
        data: {
          customerName: input.customerName,
          outcome: input.outcome,
          notes: input.notes,
          nextFollowUp: input.nextFollowUp || null,
          status: input.status,
        },
      }),
    onSuccess: () => {
      haptic("tick");
      toast.success("Call logged");
      setCallFor(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rename = useMutation({
    mutationFn: () => updateMyProfile({ data: { displayName: name } }),
    onSuccess: () => {
      toast.success("Name on the board updated");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const saveGoal = useMutation({
    mutationFn: (monthlyGoal: number) => updateMyProfile({ data: { monthlyGoal } }),
    onSuccess: (_, monthlyGoal) => {
      haptic("tick");
      setGoalDraft("");
      toast.success(`Monthly goal set to ${monthlyGoal}`);
      invalidate();
    },
    onError: (err) => {
      haptic("error");
      toast.error(err.message);
    },
  });

  if (!day.data) return <div className="h-80 animate-pulse rounded-xl bg-surface" />;

  const { me, todaySales, todayCalls, followUps, monthCount, monthGoal, weekCount } = day.data;
  const volume = todaySales.reduce((s, sale) => s + sale.dealValue, 0);
  const progress = Math.min(100, Math.round((monthCount / Math.max(monthGoal, 1)) * 100));
  const selfColumn = {
    ...me,
    sales: todaySales,
    periodCount: todaySales.length,
    todayCount: todaySales.length,
    callCount: todayCalls.length,
    followUpsDue: followUps.length,
    monthPay: pay.data?.pay.net ?? 0,
    tierRate: pay.data?.pay.rate ?? 0.1,
    closeRate: conv.data?.mine.closeRate ?? 0,
    out: null,
  } satisfies PersonColumn;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
            {me.displayName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">My day</h1>
          <p className="mt-1 text-sm text-muted">{formatShort(todayIso())} · SuperC-Leads desk</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="ink" className="w-full sm:w-auto" onClick={() => setCallFor("new")}>
            Log a call
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setSaleOpen(true)}>
            Post an X
          </Button>
        </div>
      </div>

      {desk.data ? (
        <DeskReady
          checks={buildChecklist({
            profile: desk.data.profile,
            w9: desk.data.w9,
            bank: desk.data.bank,
          })}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="X today" value={String(todaySales.length)} detail={formatMoney(volume)} />
        <Tile label="Calls today" value={String(todayCalls.length)} detail="Logged reach-outs" />
        <Tile label="Follow-ups due" value={String(followUps.length)} detail="Need a touch" />
        <Tile
          label="Close rate"
          value={conv.data ? `${conv.data.mine.closeRate % 1 ? conv.data.mine.closeRate.toFixed(1) : conv.data.mine.closeRate}%` : "—"}
          detail={`${monthCount} this month`}
        />
      </div>

      {conv.data ? <ConversionCard mine={conv.data.mine} floor={conv.data.floor} compact /> : null}

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Month goal</p>
            <p className="mt-1 text-xs text-muted">
              {monthCount} closed · this is your Target on the board
            </p>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const next = Number(goalDraft || monthGoal);
              if (!Number.isFinite(next) || next < 1) {
                haptic("error");
                toast.error("Goal has to be at least 1");
                return;
              }
              saveGoal.mutate(Math.round(next));
            }}
          >
            <Input
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              value={goalDraft === "" ? String(monthGoal) : goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              className="h-11 w-20 text-center tabular-nums"
              aria-label="Monthly X goal"
            />
            <Button type="submit" variant="ink" disabled={saveGoal.isPending}>
              Set goal
            </Button>
          </form>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </section>

      {pay.data ? <PayCard pay={pay.data.pay} compact /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Today’s X</h2>
            <Link to="/" className="text-xs text-muted hover:text-fg">
              Open board
            </Link>
          </div>
          {todaySales.length === 0 ? (
            <p className="py-8 text-sm text-muted">No X yet. Close one and mark the board.</p>
          ) : (
            <ul className="divide-y divide-border">
              {todaySales.map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{sale.customerName || "Closed deal"}</p>
                    <p className="text-xs text-muted">{sale.notes || "SuperC-Leads"}</p>
                  </div>
                  <p className="text-sm tabular-nums">{formatMoney(sale.dealValue)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Calls</h2>
            <Link to="/crm" className="text-xs text-muted hover:text-fg">
              CRM
            </Link>
          </div>
          {todayCalls.length === 0 ? (
            <p className="py-8 text-sm text-muted">No calls logged today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {todayCalls.map((call) => (
                <li key={call.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{call.customerName || "Call"}</p>
                    <p className="text-xs text-muted">{call.notes || "—"}</p>
                  </div>
                  <p className="text-xs text-muted">{OUTCOME_LABEL[call.outcome]}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Follow-ups on your desk</h2>
          <Link to="/follow-ups" className="text-xs text-muted hover:text-fg">
            Sequence
          </Link>
        </div>
        {followUps.length === 0 ? (
          <p className="py-6 text-sm text-muted">Nothing overdue. Stay ahead of the list.</p>
        ) : (
          <ul className="divide-y divide-border">
            {followUps.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    to="/crm/$customerId"
                    params={{ customerId: String(c.id) }}
                    className="text-sm font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {c.currentStepTitle
                      ? `${c.currentStepTitle} · ${formatShort(c.nextFollowUp ?? "")}`
                      : `${c.company || "Prospect"} · due ${formatShort(c.nextFollowUp ?? "")}`}
                  </p>
                </div>
                <Button size="sm" variant="ink" onClick={() => setCallFor(c)}>
                  Call
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Name on the board</h2>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) rename.mutate();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={me.displayName}
          />
          <Button type="submit" variant="ink" disabled={rename.isPending}>
            Update
          </Button>
        </form>
      </section>

      <SaleDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        person={selfColumn}
        sale={null}
        canOverride
        busy={saleMut.isPending}
        onSave={(input) => saleMut.mutate(input)}
      />
      <CallDialog
        open={callFor !== null}
        onOpenChange={(open) => {
          if (!open) setCallFor(null);
        }}
        customer={callFor && callFor !== "new" ? callFor : null}
        busy={callMut.isPending}
        onSave={(input) => callMut.mutate(input)}
      />
    </div>
  );
}

function DeskReady({
  checks,
}: {
  checks: ReturnType<typeof buildChecklist>;
}) {
  const missing = checks.filter((c) => !c.done);
  if (missing.length === 0) return null;
  return (
    <Link
      to="/desk"
      className="block rounded-xl border border-warn/40 bg-surface p-4 hover:border-warn"
    >
      <p className="text-sm font-medium">Finish your desk to get paid</p>
      <p className="mt-1 text-xs text-muted">
        {missing.map((c) => c.label).join(" · ")}
      </p>
    </Link>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-subtle">{detail}</p>
    </div>
  );
}
