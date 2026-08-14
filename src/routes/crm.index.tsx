import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConversionCard } from "@/components/conversion-card";
import { CallDialog } from "@/components/call-dialog";
import { CustomerDialog, type CustomerForm } from "@/components/customer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteCustomer,
  listCustomers,
  getConversion,
  logCall,
  moveCustomerStatus,
  upsertCustomer,
} from "@/lib/floor/server";
import { PIPELINE, SOURCE_LABEL, STATUS_LABEL, formatMoney, formatShort, todayIso } from "@/lib/floor/period";
import type { Customer, CustomerStatus } from "@/lib/floor/types";
import { useIsMobile } from "@/lib/use-is-mobile";
import { haptic } from "@/lib/floor/haptics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crm/")({ component: CrmDesk });

function CrmDesk() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [view, setView] = useState<"pipeline" | "list" | "due" | null>(null);
  const resolvedView = view ?? (isMobile ? "list" : "pipeline");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<CustomerStatus | "all">("all");
  const [customer, setCustomer] = useState<Customer | null | "new">(null);
  const [callFor, setCallFor] = useState<Customer | null | "new">(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const customers = useQuery({
    queryKey: ["customers", scope],
    queryFn: () => listCustomers({ data: { scope, filter: "all" } }),
  });

  const conversion = useQuery({
    queryKey: ["conversion"],
    queryFn: () => getConversion({ data: { period: "month" } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["calls"] });
    void queryClient.invalidateQueries({ queryKey: ["day"] });
    void queryClient.invalidateQueries({ queryKey: ["floor"] });
    void queryClient.invalidateQueries({ queryKey: ["crm"] });
    void queryClient.invalidateQueries({ queryKey: ["sequence"] });
    void queryClient.invalidateQueries({ queryKey: ["conversion"] });
  };

  const saveCustomer = useMutation({
    mutationFn: (input: CustomerForm) =>
      upsertCustomer({
        data: {
          id: customer && customer !== "new" ? customer.id : undefined,
          name: input.name,
          phone: input.phone,
          email: input.email,
          company: input.company,
          city: input.city,
          source: input.source || undefined,
          status: input.status,
          notes: input.notes,
          nextFollowUp: input.nextFollowUp || null,
          ownerId: input.ownerId,
          monthlySpend: input.monthlySpend ? Number(input.monthlySpend) : null,
          currentProvider: input.currentProvider,
          painNotes: input.painNotes,
          firstDemoOn: input.firstDemoOn || null,
          sequenceKey: input.sequenceKey,
        },
      }),
    onSuccess: (saved) => {
      toast.success("Record saved");
      setCustomer(null);
      invalidate();
      void navigate({ to: "/crm/$customerId", params: { customerId: String(saved.id) } });
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteCustomer({ data: { id } }),
    onSuccess: () => {
      toast.success("Record removed");
      setCustomer(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const move = useMutation({
    mutationFn: (data: { id: number; status: CustomerStatus }) => moveCustomerStatus({ data }),
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });

  const callMut = useMutation({
    mutationFn: (input: {
      customerName: string;
      outcome: "connected" | "voicemail" | "no_answer" | "booked" | "sold" | "not_interested";
      notes: string;
      nextFollowUp: string;
      status: CustomerStatus;
    }) =>
      logCall({
        data: {
          customerId: callFor && callFor !== "new" ? callFor.id : undefined,
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

  const today = todayIso();
  const me = customers.data?.me;
  const seats = customers.data?.seats ?? [];
  const all = customers.data?.customers ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((c) => {
      if (resolvedView === "due") {
        if (!(c.nextFollowUp && c.nextFollowUp <= today && c.status !== "sold" && c.status !== "dead")) {
          return false;
        }
      }
      if (stage !== "all" && c.status !== stage) return false;
      if (!q) return true;
      const blob = [c.name, c.company, c.phone, c.email, c.city, c.currentProvider, c.ownerName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [all, query, resolvedView, stage, today]);

  const dueCount = all.filter(
    (c) => c.nextFollowUp && c.nextFollowUp <= today && c.status !== "sold" && c.status !== "dead",
  ).length;
  const openCount = all.filter((c) => c.status !== "sold" && c.status !== "dead").length;
  const bookedCount = all.filter((c) => c.status === "booked").length;

  if (!customers.data || !me) {
    return <div className="h-80 animate-pulse rounded-xl bg-surface" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
            SuperC-Leads CRM
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pipeline</h1>
          <p className="mt-1 text-sm text-muted">
            Every ownership conversation. Move the stage. Close to the board.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Link to="/follow-ups" className="contents sm:block">
            <Button variant="ink" className="w-full sm:w-auto">
              Sequence
            </Button>
          </Link>
          <Button variant="ink" className="w-full sm:w-auto" onClick={() => setCallFor("new")}>
            Log a call
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setCustomer("new")}>
            New record
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Open" value={String(openCount)} hint="Live records" />
        <Stat label="Due" value={String(dueCount)} hint="Need a touch" />
        <Stat label="Booked" value={String(bookedCount)} hint="Demos on the books" />
      </div>

      {conversion.data ? (
        <ConversionCard
          mine={scope === "all" && me.role === "admin" ? conversion.data.floor : conversion.data.mine}
          floor={conversion.data.floor}
        />
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {(["pipeline", "list", "due"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                haptic("tap");
                setView(key);
              }}
              className={cn(
                "h-10 rounded-sm px-3 text-sm font-medium capitalize",
                resolvedView === key ? "bg-primary text-primary-fg" : "bg-raised text-muted hover:text-fg",
              )}
            >
              {key === "due" ? `Due (${dueCount})` : key}
            </button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, company, phone"
          className="h-11 w-full lg:ml-auto lg:max-w-xs"
        />
        {me.role === "admin" && (
          <button
            type="button"
            onClick={() => setScope(scope === "mine" ? "all" : "mine")}
            className="h-10 rounded-sm bg-raised px-3 text-sm text-muted hover:text-fg"
          >
            {scope === "all" ? "Whole floor" : "My desk"}
          </button>
        )}
      </div>

      {resolvedView === "pipeline" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="snap-row flex gap-3 pb-1">
            {PIPELINE.map((col) => {
              const rows = filtered.filter((c) => c.status === col.key);
              return (
                <section
                  key={col.key}
                  className="snap-card flex w-[min(16.5rem,82vw)] shrink-0 flex-col rounded-xl border border-border bg-surface sm:w-44"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragging != null) {
                      haptic("drop");
                      move.mutate({ id: dragging, status: col.key });
                    }
                    setDragging(null);
                  }}
                >
                  <header className="flex items-center justify-between px-3 py-2">
                    <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                      {col.label}
                    </p>
                    <span className="text-[11px] tabular-nums text-subtle">{rows.length}</span>
                  </header>
                  <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                    {rows.map((c) => (
                      <Card
                        key={c.id}
                        customer={c}
                        today={today}
                        showOwner={me.role === "admin"}
                        mobile={isMobile}
                        onMove={(status) => move.mutate({ id: c.id, status })}
                        onDrag={() => setDragging(c.id)}
                        onOpen={() =>
                          void navigate({ to: "/crm/$customerId", params: { customerId: String(c.id) } })
                        }
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          {resolvedView === "list" ? (
            <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
              {(["all", ...PIPELINE.map((p) => p.key)] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStage(key)}
                  className={cn(
                    "h-8 rounded-sm px-2 text-xs capitalize",
                    stage === key ? "bg-raised text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {key === "all" ? "All" : STATUS_LABEL[key]}
                </button>
              ))}
            </div>
          ) : null}
          {filtered.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">
              {resolvedView === "due"
                ? "Nothing due. Add a record or log a call."
                : "No records match. Create one to start the pipe."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => {
                const overdue = Boolean(c.nextFollowUp && c.nextFollowUp < today);
                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      to="/crm/$customerId"
                      params={{ customerId: String(c.id) }}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted">
                        {[c.company, c.city, c.phone].filter(Boolean).join(" · ") || "Prospect"}
                        {me.role === "admin" ? ` · ${c.ownerName}` : ""}
                      </p>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.status === "sold" ? "pine" : c.status === "dead" ? "danger" : "default"}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                      {c.nextFollowUp ? (
                        <Badge tone={overdue ? "warn" : "default"}>{formatShort(c.nextFollowUp)}</Badge>
                      ) : null}
                      <select
                        value={c.status}
                        aria-label={`Move ${c.name}`}
                        onChange={(e) => {
                          haptic("drop");
                          move.mutate({ id: c.id, status: e.target.value as CustomerStatus });
                        }}
                        className="h-11 rounded-sm border border-border bg-bg px-2 text-xs md:hidden"
                      >
                        {PIPELINE.map((col) => (
                          <option key={col.key} value={col.key}>
                            {col.label}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" className="min-h-11 sm:min-h-9" variant="ink" onClick={() => setCallFor(c)}>
                        Call
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <CustomerDialog
        open={customer !== null}
        onOpenChange={(open) => {
          if (!open) setCustomer(null);
        }}
        customer={customer && customer !== "new" ? customer : null}
        me={me}
        people={seats}
        busy={saveCustomer.isPending || remove.isPending}
        onSave={(input) => saveCustomer.mutate(input)}
        onDelete={customer && customer !== "new" ? () => remove.mutate(customer.id) : undefined}
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

function Card({
  customer,
  today,
  showOwner,
  mobile,
  onMove,
  onDrag,
  onOpen,
}: {
  customer: Customer;
  today: string;
  showOwner: boolean;
  mobile: boolean;
  onMove: (status: CustomerStatus) => void;
  onDrag: () => void;
  onOpen: () => void;
}) {
  const overdue = Boolean(customer.nextFollowUp && customer.nextFollowUp < today);
  return (
    <li>
      <div className="rounded-md border border-border bg-raised px-2.5 py-2">
      <button
        type="button"
        draggable={!mobile}
        onDragStart={() => {
          haptic("tick");
          onDrag();
        }}
        onClick={() => {
          haptic("tap");
          onOpen();
        }}
        className="w-full text-left"
      >
        <p className="truncate text-sm font-medium">{customer.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {customer.company || customer.city || SOURCE_LABEL[customer.source ?? ""] || "Prospect"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {customer.nextFollowUp ? (
            <span className={cn("text-[10px] tabular-nums", overdue ? "text-warn" : "text-subtle")}>
              {formatShort(customer.nextFollowUp)}
            </span>
          ) : null}
          {customer.monthlySpend ? (
            <span className="text-[10px] tabular-nums text-subtle">
              {formatMoney(customer.monthlySpend)}/mo
            </span>
          ) : null}
          {showOwner ? (
            <span className="text-[10px] text-subtle">{customer.ownerName.split(" ")[0]}</span>
          ) : null}
        </div>
      </button>
      {mobile ? (
        <select
          value={customer.status}
          aria-label={`Move ${customer.name}`}
          onChange={(e) => {
            haptic("drop");
            onMove(e.target.value as CustomerStatus);
          }}
          className="mt-2 h-11 w-full rounded-sm border border-border bg-bg px-2 text-xs"
        >
          {PIPELINE.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
      ) : null}
      </div>
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; hint: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}
