import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CallDialog } from "@/components/call-dialog";
import { SaleDialog } from "@/components/sale-dialog";
import { SequenceRail } from "@/components/sequence-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addCustomerNote,
  completeFollowUpStep,
  deleteCustomer,
  enrollSequence,
  getCustomerRecord,
  logCall,
  postSale,
  skipFollowUpStep,
  upsertCustomer,
} from "@/lib/floor/server";
import {
  formatLong,
  formatMoney,
  formatShort,
  OUTCOME_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  todayIso,
} from "@/lib/floor/period";
import { formatPay } from "@/lib/floor/pay";
import type { CustomerStatus, LeadSource, PersonColumn, SaleInput } from "@/lib/floor/types";
import { SEQUENCE_KEYS, SEQUENCES, type SequenceKey } from "@/lib/floor/sequence";
import { tickBoard } from "@/lib/floor/sound";
import { haptic } from "@/lib/floor/haptics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crm/$customerId")({ component: RecordViewWrapped });

function RecordViewWrapped() {
  const { customerId } = Route.useParams();
  return <RecordView id={Number(customerId)} />;
}

function RecordView({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const record = useQuery({
    queryKey: ["crm", id],
    queryFn: () => getCustomerRecord({ data: { id } }),
  });
  const [callOpen, setCallOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [note, setNote] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["crm", id] });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["day"] });
    void queryClient.invalidateQueries({ queryKey: ["floor"] });
    void queryClient.invalidateQueries({ queryKey: ["pay"] });
    void queryClient.invalidateQueries({ queryKey: ["sequence"] });
  };

  const save = useMutation({
    mutationFn: (data: Parameters<typeof upsertCustomer>[0]["data"]) => upsertCustomer({ data }),
    onSuccess: () => {
      toast.success("Record updated");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const addNote = useMutation({
    mutationFn: () => addCustomerNote({ data: { customerId: id, body: note } }),
    onSuccess: () => {
      setNote("");
      toast.success("Note added");
      invalidate();
    },
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
          customerId: id,
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
      setCallOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const saleMut = useMutation({
    mutationFn: (input: SaleInput) =>
      postSale({
        data: {
          customerId: id,
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
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteCustomer({ data: { id } }),
    onSuccess: () => {
      toast.success("Record removed");
      void navigate({ to: "/crm" });
    },
    onError: (err) => toast.error(err.message),
  });

  const enroll = useMutation({
    mutationFn: (key: SequenceKey) => enrollSequence({ data: { customerId: id, key } }),
    onSuccess: () => {
      haptic("tick");
      toast.success("Sequence is on the desk");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const completeStep = useMutation({
    mutationFn: (stepId: number) => completeFollowUpStep({ data: { id: stepId } }),
    onSuccess: () => {
      haptic("tick");
      toast.success("Step done");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const skipStep = useMutation({
    mutationFn: (stepId: number) => skipFollowUpStep({ data: { id: stepId } }),
    onSuccess: () => {
      haptic("tick");
      toast.success("Skipped");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (record.isError) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">{record.error.message}</p>
        <Link to="/crm" className="mt-3 inline-block text-sm hover:underline">
          Back to CRM
        </Link>
      </div>
    );
  }

  if (!record.data) return <div className="h-80 animate-pulse rounded-xl bg-surface" />;

  const { me, seats } = record.data;
  const c = record.data.record.customer;
  const { notes, calls, sales } = record.data.record;
  const overdue = Boolean(c.nextFollowUp && c.nextFollowUp < todayIso());
  const painReady = Boolean(c.monthlySpend && (c.painNotes || c.currentProvider));

  const selfColumn = {
    ...me,
    sales: [],
    periodCount: 0,
    todayCount: 0,
    callCount: 0,
    followUpsDue: 0,
    monthPay: 0,
    tierRate: 0.1,
    closeRate: 0,
    out: null,
  } satisfies PersonColumn;

  const timeline = [
    ...notes.map((n) => ({
      key: `n-${n.id}`,
      at: n.createdAt,
      kind: "note" as const,
      title: n.authorName,
      body: n.body,
    })),
    ...calls.map((call) => ({
      key: `c-${call.id}`,
      at: call.calledAt,
      kind: "call" as const,
      title: `${call.userName} · ${OUTCOME_LABEL[call.outcome]}`,
      body: call.notes || "Call logged",
    })),
    ...sales.map((sale) => ({
      key: `s-${sale.id}`,
      at: sale.soldAt,
      kind: "sale" as const,
      title: `Closed · ${formatPay(sale.dealValue)}`,
      body: [
        sale.intelligence ? "Intelligence" : null,
        sale.painKiller ? "Pain Killer" : null,
        sale.speedClose ? "Speed Close" : null,
        sale.refunded ? "Refunded" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Ownership close",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/crm" className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase hover:text-fg">
            CRM
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{c.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {[c.company, c.city].filter(Boolean).join(" · ") || "Prospect"}
            {" · "}
            {c.ownerName}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="ink" className="w-full sm:w-auto" onClick={() => setCallOpen(true)}>
            Log a call
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setSaleOpen(true)}>
            Close
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={c.status === "sold" ? "pine" : c.status === "dead" ? "danger" : "default"}>
          {STATUS_LABEL[c.status]}
        </Badge>
        {c.source ? <Badge>{SOURCE_LABEL[c.source]}</Badge> : null}
        {c.nextFollowUp ? (
          <Badge tone={overdue ? "warn" : "default"}>
            Follow-up {formatShort(c.nextFollowUp)}
          </Badge>
        ) : null}
        {c.currentStepTitle ? <Badge>{c.currentStepTitle}</Badge> : null}
        <span className="text-xs text-subtle">
          {c.callCount} call{c.callCount === 1 ? "" : "s"} · {c.saleCount} close
          {c.saleCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Record</h2>
            <form
              key={`${c.id}-${c.status}-${c.saleCount}-${c.monthlySpend ?? 0}`}
              className="mt-3 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                save.mutate({
                  id: c.id,
                  name: String(form.get("name") ?? ""),
                  phone: String(form.get("phone") ?? ""),
                  email: String(form.get("email") ?? ""),
                  company: String(form.get("company") ?? ""),
                  city: String(form.get("city") ?? ""),
                  source: (String(form.get("source") ?? "") || undefined) as LeadSource | undefined,
                  status: String(form.get("status") ?? c.status) as CustomerStatus,
                  notes: String(form.get("notes") ?? ""),
                  nextFollowUp: String(form.get("nextFollowUp") ?? "") || null,
                  ownerId: String(form.get("ownerId") ?? c.ownerId),
                  monthlySpend: form.get("monthlySpend")
                    ? Number(form.get("monthlySpend"))
                    : null,
                  currentProvider: String(form.get("currentProvider") ?? ""),
                  painNotes: String(form.get("painNotes") ?? ""),
                  firstDemoOn: String(form.get("firstDemoOn") ?? "") || null,
                });
              }}
            >
              <Field label="Name">
                <Input name="name" defaultValue={c.name} required />
              </Field>
              <Field label="Company / trade">
                <Input name="company" defaultValue={c.company ?? ""} />
              </Field>
              <Field label="Phone">
                <Input name="phone" defaultValue={c.phone ?? ""} />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" defaultValue={c.email ?? ""} />
              </Field>
              <Field label="City">
                <Input name="city" defaultValue={c.city ?? ""} />
              </Field>
              <Field label="Source">
                <select
                  name="source"
                  defaultValue={c.source ?? "outbound"}
                  className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm"
                >
                  {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stage">
                <select
                  name="status"
                  defaultValue={c.status}
                  className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm"
                >
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Follow up">
                <Input name="nextFollowUp" type="date" defaultValue={c.nextFollowUp ?? ""} />
              </Field>
              {me.role === "admin" ? (
                <Field label="Owner">
                  <select
                    name="ownerId"
                    defaultValue={c.ownerId}
                    className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm"
                  >
                    {seats.map((s) => (
                      <option key={s.userId} value={s.userId}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <input type="hidden" name="ownerId" value={c.ownerId} />
              )}
              <Field label="Internal notes" className="sm:col-span-2">
                <Textarea name="notes" defaultValue={c.notes ?? ""} />
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
                  Pain Killer fields
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Monthly / annual lead spend">
                    <Input
                      name="monthlySpend"
                      type="number"
                      min={0}
                      defaultValue={c.monthlySpend ?? ""}
                    />
                  </Field>
                  <Field label="Current provider">
                    <Input
                      name="currentProvider"
                      defaultValue={c.currentProvider ?? ""}
                      placeholder="Shared leads, rented list…"
                    />
                  </Field>
                  <Field label="First live demo">
                    <Input name="firstDemoOn" type="date" defaultValue={c.firstDemoOn ?? ""} />
                  </Field>
                  <Field label="Pain language">
                    <Input
                      name="painNotes"
                      defaultValue={c.painNotes ?? ""}
                      placeholder="Exact words: multi-sold, shared…"
                    />
                  </Field>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {painReady
                    ? "Pain Killer is ready on the next close."
                    : "Need a spend number plus their language about rented / shared / multi-sold leads."}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  Remove
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  Save record
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) addNote.mutate();
              }}
            >
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note to this record"
                className="min-h-11"
              />
              <Button type="submit" variant="ink" disabled={addNote.isPending}>
                Add note
              </Button>
            </form>
            {timeline.length === 0 ? (
              <p className="py-8 text-sm text-muted">No activity yet. Log a call or leave a note.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {timeline.map((item) => (
                  <li key={item.key} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-[11px] text-subtle">
                        {formatLong(item.at.slice(0, 10))}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted">{item.body}</p>
                    <p className="mt-1 text-[10px] tracking-wide text-subtle uppercase">{item.kind}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {record.data.record.steps.length > 0 ? (
            <SequenceRail
              steps={record.data.record.steps}
              busy={completeStep.isPending || skipStep.isPending || enroll.isPending}
              onComplete={(stepId) => completeStep.mutate(stepId)}
              onSkip={(stepId) => skipStep.mutate(stepId)}
              onEnroll={(key) => enroll.mutate(key)}
            />
          ) : (
            <section className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Sequence</p>
              <h2 className="mt-1 text-sm font-semibold">Put them on a cadence</h2>
              <p className="mt-1 text-xs text-muted">Hunt a new file, lock a demo, or revive a cold one.</p>
              <div className="mt-3 grid gap-2">
                {SEQUENCE_KEYS.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant="ink"
                    className="h-auto justify-start py-2 text-left"
                    disabled={enroll.isPending}
                    onClick={() => enroll.mutate(key)}
                  >
                    <span>
                      <span className="block text-sm">{SEQUENCES[key].name}</span>
                      <span className="block text-xs font-normal text-muted">{SEQUENCES[key].blurb}</span>
                    </span>
                  </Button>
                ))}
              </div>
            </section>
          )}
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Contact</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Row
                label="Phone"
                value={c.phone || "—"}
                href={c.phone ? `tel:${c.phone.replace(/[^\d+]/g, "")}` : undefined}
              />
              <Row label="Email" value={c.email || "—"} href={c.email ? `mailto:${c.email}` : undefined} />
              <Row label="Last touch" value={c.lastContacted ? formatShort(c.lastContacted) : "Never"} />
              <Row label="Added" value={formatShort(c.createdAt.slice(0, 10))} />
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Closes</h2>
            {sales.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No ownership close on this record.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {sales.map((sale) => (
                  <li key={sale.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-muted">{formatShort(sale.soldOn)}</span>
                    <span className="tabular-nums">{formatMoney(sale.dealValue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <CallDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        customer={c}
        busy={callMut.isPending}
        onSave={(input) => callMut.mutate(input)}
      />
      <SaleDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        person={selfColumn}
        sale={null}
        canOverride
        isAdmin={me.role === "admin"}
        busy={saleMut.isPending}
        onSave={(input) =>
          saleMut.mutate({
            ...input,
            customerName: input.customerName || c.name,
            firstDemoOn: input.firstDemoOn || c.firstDemoOn || "",
            painKiller: input.painKiller || painReady,
            speedClose: input.speedClose,
            customerId: id,
          })
        }
      />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={href ? "min-h-11 text-right" : "text-right"}>
        {href ? (
          <a href={href} className="hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
