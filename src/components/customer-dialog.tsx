import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, CustomerStatus, LeadSource, Profile, Seat } from "@/lib/floor/types";
import { SOURCE_LABEL, STATUS_LABEL, todayIso } from "@/lib/floor/period";
import { SEQUENCES, SEQUENCE_KEYS } from "@/lib/floor/sequence";

const STATUSES: CustomerStatus[] = [
  "new",
  "contacted",
  "follow_up",
  "booked",
  "sold",
  "dead",
];

const SOURCES: LeadSource[] = ["inbound", "outbound", "referral", "repeat", "other"];

export type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  company: string;
  city: string;
  source: LeadSource | "";
  status: CustomerStatus;
  notes: string;
  nextFollowUp: string;
  ownerId: string;
  monthlySpend: string;
  currentProvider: string;
  painNotes: string;
  firstDemoOn: string;
  sequenceKey: string;
};

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  me,
  people,
  onSave,
  onDelete,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  me: Profile;
  people: Seat[];
  onSave: (input: CustomerForm) => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [source, setSource] = useState<LeadSource | "">("outbound");
  const [status, setStatus] = useState<CustomerStatus>("new");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [ownerId, setOwnerId] = useState(me.userId);
  const [sequenceKey, setSequenceKey] = useState("hunt");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        onOpenAutoFocus={() => {
          setName(customer?.name ?? "");
          setPhone(customer?.phone ?? "");
          setEmail(customer?.email ?? "");
          setCompany(customer?.company ?? "");
          setCity(customer?.city ?? "");
          setSource(customer?.source ?? "outbound");
          setStatus(customer?.status ?? "new");
          setNotes(customer?.notes ?? "");
          setNextFollowUp(customer?.nextFollowUp ?? todayIso());
          setOwnerId(customer?.ownerId ?? me.userId);
          setSequenceKey(customer?.sequenceKey ?? "hunt");
        }}
      >
        <DialogHeader>
          <DialogTitle>{customer ? "Edit record" : "New record"}</DialogTitle>
          <DialogDescription>
            Add a prospect to the SuperC-Leads CRM. Open the record to log calls, pain, and close.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              name,
              phone,
              email,
              company,
              city,
              source,
              status,
              notes,
              nextFollowUp,
              ownerId,
              monthlySpend: customer ? String(customer.monthlySpend ?? "") : "",
              currentProvider: customer?.currentProvider ?? "",
              painNotes: customer?.painNotes ?? "",
              firstDemoOn: customer?.firstDemoOn ?? "",
              sequenceKey,
            });
          }}
        >
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company / trade">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="HVAC, roofing…" />
            </Field>
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <select
                className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm"
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stage">
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
          <Field label="Sequence">
            <select
              className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm"
              value={sequenceKey}
              onChange={(e) => setSequenceKey(e.target.value)}
            >
              <option value="none">One date only</option>
              {SEQUENCE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SEQUENCES[key].name} — {SEQUENCES[key].steps.length} steps
                </option>
              ))}
            </select>
          </Field>
          <Field label="First touch / start">
            <Input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
          </Field>
          {me.role === "admin" && people.length > 0 && (
            <Field label="Assigned to">
              <select
                className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {people.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex items-center justify-between gap-2 pt-2">
            {customer && onDelete ? (
              <Button type="button" variant="danger" onClick={onDelete} disabled={busy}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy}>
              Save
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
