import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CallOutcome, Customer, CustomerStatus } from "@/lib/floor/types";
import { OUTCOME_LABEL, STATUS_LABEL } from "@/lib/floor/period";

const OUTCOMES: CallOutcome[] = [
  "connected",
  "voicemail",
  "no_answer",
  "booked",
  "sold",
  "not_interested",
];

const STATUSES: CustomerStatus[] = [
  "new",
  "contacted",
  "follow_up",
  "booked",
  "sold",
  "dead",
];

export function CallDialog({
  open,
  onOpenChange,
  customer,
  onSave,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSave: (input: {
    customerName: string;
    outcome: CallOutcome;
    notes: string;
    nextFollowUp: string;
    status: CustomerStatus;
  }) => void;
  busy?: boolean;
}) {
  const [customerName, setCustomerName] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [status, setStatus] = useState<CustomerStatus>("contacted");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={() => {
          setCustomerName(customer?.name ?? "");
          setOutcome("connected");
          setStatus(customer?.status === "new" ? "contacted" : (customer?.status ?? "contacted"));
          setNotes("");
          setNextFollowUp(customer?.nextFollowUp ?? "");
        }}
      >
        <DialogHeader>
          <DialogTitle>Log a call</DialogTitle>
          <DialogDescription>
            {customer?.currentStepTitle
              ? `This call hits “${customer.currentStepTitle}”. The next step writes its own date.`
              : "Track every reach-out. Follow-ups stay on your desk until they close or die."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ customerName, outcome, notes, nextFollowUp, status });
          }}
        >
          <Field label="Who you called">
            <Input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Outcome">
              <select
                className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CallOutcome)}
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Next follow-up">
            <Input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
          </Field>
          {customer?.currentStepTitle ? (
            <p className="text-xs text-muted">
              Saving this call marks “{customer.currentStepTitle}” done and opens the next beat.
            </p>
          ) : null}
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What they said" />
          </Field>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={busy}>
              Save call
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
