import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CallDialog } from "@/components/call-dialog";
import { FloorGate } from "@/components/gate";
import { SequenceTaskRow } from "@/components/sequence-rail";
import { Button } from "@/components/ui/button";
import {
  completeFollowUpStep,
  listSequenceDesk,
  logCall,
  skipFollowUpStep,
} from "@/lib/floor/server";
import { haptic } from "@/lib/floor/haptics";
import type { Customer, CustomerStatus, SequenceTask } from "@/lib/floor/types";

export const Route = createFileRoute("/follow-ups")({ component: FollowUpsPage });

function FollowUpsPage() {
  return <FloorGate>{() => <Desk />}</FloorGate>;
}

function Desk() {
  const queryClient = useQueryClient();
  const desk = useQuery({
    queryKey: ["sequence"],
    queryFn: () => listSequenceDesk({ data: {} }),
  });
  const [tab, setTab] = useState<"due" | "upcoming">("due");
  const [callFor, setCallFor] = useState<SequenceTask | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["sequence"] });
    void queryClient.invalidateQueries({ queryKey: ["crm"] });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["day"] });
  };

  const complete = useMutation({
    mutationFn: (id: number) => completeFollowUpStep({ data: { id } }),
    onSuccess: () => {
      haptic("tick");
      toast.success("Step done. Next one is on the desk.");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const skip = useMutation({
    mutationFn: (id: number) => skipFollowUpStep({ data: { id } }),
    onSuccess: () => {
      haptic("tick");
      toast.success("Skipped. Next step is live.");
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
          customerId: callFor?.customerId,
          customerName: input.customerName,
          outcome: input.outcome,
          notes: input.notes,
          nextFollowUp: input.nextFollowUp || null,
          status: input.status,
          advanceSequence: true,
        },
      }),
    onSuccess: () => {
      haptic("tick");
      toast.success("Call logged · sequence advanced");
      setCallFor(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!desk.data) return <div className="h-80 animate-pulse rounded-xl bg-surface" />;

  const rows = tab === "due" ? desk.data.due : desk.data.upcoming;
  const callCustomer = callFor
    ? ({
        id: callFor.customerId,
        name: callFor.customerName,
        company: callFor.company,
        phone: callFor.phone,
        nextFollowUp: callFor.dueOn,
        status: "follow_up",
        currentStepTitle: callFor.title,
        currentStepId: callFor.id,
      } as Customer)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase">Sequence</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Follow-ups</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Hunt, booked demo, revive. Hit the step, the next date writes itself.
          </p>
        </div>
        <Link to="/crm">
          <Button variant="ink">Open CRM</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            haptic("tap");
            setTab("due");
          }}
          className={`rounded-xl border px-4 py-3 text-left ${
            tab === "due" ? "border-fg bg-surface" : "border-border bg-surface"
          }`}
        >
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Due now</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{desk.data.due.length}</p>
        </button>
        <button
          type="button"
          onClick={() => {
            haptic("tap");
            setTab("upcoming");
          }}
          className={`rounded-xl border px-4 py-3 text-left ${
            tab === "upcoming" ? "border-fg bg-surface" : "border-border bg-surface"
          }`}
        >
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Upcoming</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{desk.data.upcoming.length}</p>
        </button>
      </div>

      <section className="rounded-xl border border-border bg-surface px-4">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">
            {tab === "due" ? "Nothing due. Stay ahead of the list." : "No later steps on the books."}
          </p>
        ) : (
          <ul>
            {rows.map((task) => (
              <SequenceTaskRow
                key={task.id}
                task={task}
                busy={complete.isPending || skip.isPending}
                onCall={() => setCallFor(task)}
                onComplete={() => complete.mutate(task.id)}
                onSkip={() => skip.mutate(task.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <CallDialog
        open={Boolean(callFor)}
        onOpenChange={(open) => {
          if (!open) setCallFor(null);
        }}
        customer={callCustomer}
        onSave={(input) => callMut.mutate(input)}
        busy={callMut.isPending}
      />
    </div>
  );
}
