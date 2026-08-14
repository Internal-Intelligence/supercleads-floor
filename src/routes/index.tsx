import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FloorGate } from "@/components/gate";
import { SaleDialog } from "@/components/sale-dialog";
import { XBoard } from "@/components/x-board";
import { HungerStrip, requestHuntAlerts } from "@/components/hunger-strip";
import { GestureHint } from "@/components/gesture-hint";
import { deleteSale, getFloorState, postSale, updateSale } from "@/lib/floor/server";
import { todayIso } from "@/lib/floor/period";
import { formatPay } from "@/lib/floor/pay";
import { tickBoard } from "@/lib/floor/sound";
import { haptic } from "@/lib/floor/haptics";
import type { PeriodKey, PersonColumn, PostedSale, Sale, SaleInput } from "@/lib/floor/types";

export const Route = createFileRoute("/")({ component: BoardPage });

function BoardPage() {
  return (
    <FloorGate>
      {(me) => <Board meId={me.userId} />}
    </FloorGate>
  );
}

function Board({ meId }: { meId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const forUser =
    typeof window === "undefined"
      ? null
      : new URL(href, window.location.origin).searchParams.get("for");
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [target, setTarget] = useState<PersonColumn | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [freshId, setFreshId] = useState<number | null>(null);

  const floor = useQuery({
    queryKey: ["floor", period],
    queryFn: () => getFloorState({ data: { period } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["floor"] });
    void queryClient.invalidateQueries({ queryKey: ["pay"] });
    void queryClient.invalidateQueries({ queryKey: ["day"] });
    void queryClient.invalidateQueries({ queryKey: ["crm"] });
  };

  const save = useMutation({
    mutationFn: async (input: SaleInput) => {
      if (!target) throw new Error("Pick a column");
      if (sale) {
        return updateSale({
          data: {
            id: sale.id,
            customerName: input.customerName,
            dealValue: input.dealValue,
            notes: input.notes,
            soldOn: input.soldOn || sale.soldOn,
            intelligence: input.intelligence,
            painKiller: input.painKiller,
            speedClose: input.speedClose,
            firstDemoOn: input.firstDemoOn,
            refunded: input.refunded,
            markerColor: input.markerColor,
            strokeJson: input.strokeJson,
          },
        });
      }
      return postSale({
        data: {
          userId: target.userId,
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
      });
    },
    onSuccess: (result) => {
      if (!sale) {
        const posted = result as PostedSale;
        tickBoard();
        setFreshId(posted.id);
        toast.success(
          target && target.userId !== meId
            ? `X posted on ${target.displayName}'s column · ${formatPay(posted.quote.total)}`
            : `X on the board · ${formatPay(posted.quote.total)}`,
        );
      } else {
        haptic("tick");
        toast.success("X updated");
      }
      setTarget(null);
      setSale(null);
      invalidate();
    },
    onError: (err) => {
      haptic("error");
      toast.error(err.message);
    },
  });

  const pull = useMutation({
    mutationFn: async () => {
      if (!sale) throw new Error("Nothing to pull");
      return deleteSale({ data: { id: sale.id } });
    },
    onSuccess: () => {
      haptic("warn");
      toast.success("X pulled");
      setTarget(null);
      setSale(null);
      invalidate();
    },
    onError: (err) => {
      haptic("error");
      toast.error(err.message);
    },
  });

  useEffect(() => {
    requestHuntAlerts();
  }, []);

  useEffect(() => {
    if (!forUser || !floor.data) return;
    if (floor.data.me.role !== "admin") return;
    const person = floor.data.people.find((p) => p.userId === forUser);
    if (!person) return;
    setTarget(person);
    setSale(null);
    void navigate({ to: "/", replace: true });
  }, [forUser, floor.data, navigate]);

  if (floor.isPending || !floor.data) {
    return <div className="h-80 animate-pulse rounded-xl bg-surface" />;
  }

  const me = floor.data.me;
  const canOverride = me.role === "admin" || (sale ? sale.userId === meId : false);

  return (
    <>
      <div className="space-y-4">
        <HungerStrip me={me} alerts={floor.data.alerts} />
        <GestureHint />
        <XBoard
        me={me}
        people={floor.data.people}
        periodLabel={floor.data.period.label}
        periodKey={period}
        onPeriod={setPeriod}
        onPost={(person) => {
          setTarget(person);
          setSale(null);
        }}
        onOpenSale={(person, next) => {
          setTarget(person);
          setSale(next);
        }}
        freshId={freshId}
      />
      </div>
      <SaleDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setSale(null);
          }
        }}
        person={target}
        sale={sale}
        canOverride={canOverride}
        isAdmin={me.role === "admin"}
        override={Boolean(me.role === "admin" && target && target.userId !== meId)}
        busy={save.isPending || pull.isPending}
        onSave={(input) => save.mutate(input)}
        onDelete={sale && (me.role === "admin" || sale.userId === meId) ? () => pull.mutate() : undefined}
      />
    </>
  );
}
