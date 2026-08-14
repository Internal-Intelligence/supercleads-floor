import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkerPad } from "@/components/marker-pad";
import { DrawnX } from "@/components/drawn-x";
import type { PersonColumn, Sale, SaleInput } from "@/lib/floor/types";
import { firstName, todayIso } from "@/lib/floor/period";
import {
  INTEL_ATTACH,
  PAIN_KILLER,
  SPEED_CLOSE,
  formatPay,
  formatQuoteLine,
  qualifiesSpeedClose,
  quoteClose,
} from "@/lib/floor/pay";
import { getPayStatement } from "@/lib/floor/server";
import { DEFAULT_MARKER, hasDrawnX, serializeStrokes, type StrokeSet } from "@/lib/floor/markers";
import { haptic } from "@/lib/floor/haptics";

export function SaleDialog({
  open,
  onOpenChange,
  person,
  sale,
  canOverride,
  isAdmin,
  override,
  onSave,
  busy,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: PersonColumn | null;
  sale: Sale | null;
  canOverride: boolean;
  isAdmin?: boolean;
  override?: boolean;
  onSave: (input: SaleInput) => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const [customerName, setCustomerName] = useState("");
  const [dealValue, setDealValue] = useState("4995");
  const [notes, setNotes] = useState("");
  const [soldOn, setSoldOn] = useState("");
  const [firstDemoOn, setFirstDemoOn] = useState("");
  const [intelligence, setIntelligence] = useState(false);
  const [painKiller, setPainKiller] = useState(false);
  const [speedClose, setSpeedClose] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const [color, setColor] = useState<string>(DEFAULT_MARKER);
  const [strokes, setStrokes] = useState<StrokeSet | null>(null);

  const editing = Boolean(sale);
  const who = person ? firstName(person.displayName) : "rep";
  const ready = editing || hasDrawnX(strokes);
  const books = useQuery({
    queryKey: ["pay", person?.userId],
    queryFn: () => getPayStatement({ data: { userId: person?.userId } }),
    enabled: open && Boolean(person),
  });
  const liveSoldOn = soldOn || todayIso();
  const liveSpeed = speedClose || qualifiesSpeedClose(firstDemoOn || null, liveSoldOn);
  const quote = useMemo(() => {
    if (!books.data) return null;
    return quoteClose(
      books.data.month,
      books.data.life,
      {
        dealValue: Number(dealValue) || 4995,
        intelligence,
        painKiller,
        speedClose: liveSpeed,
        soldOn: liveSoldOn,
        refunded,
      },
      sale?.id ?? null,
    );
  }, [books.data, dealValue, intelligence, painKiller, liveSpeed, liveSoldOn, refunded, sale?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={() => {
          setCustomerName(sale?.customerName ?? "");
          setDealValue(String(sale?.dealValue ?? 4995));
          setNotes(sale?.notes ?? "");
          setSoldOn(sale?.soldOn ?? "");
          setFirstDemoOn(sale?.firstDemoOn ?? "");
          setIntelligence(sale?.intelligence ?? false);
          setPainKiller(sale?.painKiller ?? false);
          setSpeedClose(sale?.speedClose ?? false);
          setRefunded(sale?.refunded ?? false);
          setColor(sale?.markerColor || person?.markerColor || DEFAULT_MARKER);
          setStrokes(null);
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {override
              ? editing
                ? `Override · ${who}'s X`
                : `Override · draw for ${who}`
              : editing
                ? `X · ${who}`
                : `Draw an X · ${who}`}
          </DialogTitle>
          <DialogDescription>
            {override
              ? `This lands on ${who}'s column and counts toward their pay. Floor log will show you posted it.`
              : "Pick a marker. Draw the X with one finger — two strokes. Then hang it."}
          </DialogDescription>
        </DialogHeader>
        {override ? (
          <p className="rounded-md border border-border bg-raised px-3 py-2 text-sm">
            Admin override · {who} stays the owner of the close.
          </p>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing && !hasDrawnX(strokes)) {
              haptic("error");
              return;
            }
            onSave({
              customerName,
              dealValue: Number(dealValue) || 4995,
              notes,
              soldOn,
              intelligence,
              painKiller,
              speedClose: liveSpeed,
              firstDemoOn,
              refunded,
              markerColor: color,
              strokeJson: strokes ? serializeStrokes({ ...strokes, color }) : (sale?.strokeJson ?? ""),
            });
          }}
        >
          {editing ? (
            <div className="grid h-24 place-items-center rounded-md border border-border bg-wb">
              <DrawnX
                strokeJson={sale?.strokeJson}
                color={sale?.markerColor || color}
                className="size-16"
              />
            </div>
          ) : (
            <MarkerPad color={color} onColor={setColor} onChange={setStrokes} />
          )}
          <Field label="Customer">
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Name or company"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deal value">
              <Input
                type="number"
                min={0}
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
              />
            </Field>
            <Field label="Closed">
              <Input type="date" value={soldOn} onChange={(e) => setSoldOn(e.target.value)} />
            </Field>
          </div>
          <Field label="First live demo">
            <Input type="date" value={firstDemoOn} onChange={(e) => setFirstDemoOn(e.target.value)} />
          </Field>
          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-[11px] font-medium tracking-wide text-muted uppercase">
              Pay flags
            </legend>
            <Check
              checked={intelligence}
              onChange={setIntelligence}
              label={`Intelligence attach  +$${INTEL_ATTACH}`}
              hint="$297/mo sold and paid in the same transaction"
            />
            <Check
              checked={painKiller}
              onChange={setPainKiller}
              label={`Pain Killer  +$${PAIN_KILLER}`}
              hint="Notes must include multi-sold / rented language and a spend number"
            />
            <Check
              checked={speedClose}
              onChange={setSpeedClose}
              label={`Speed Close  +$${SPEED_CLOSE}`}
              hint="Paid within 48 hours of the first live demo"
            />
            {isAdmin ? (
              <Check
                checked={refunded}
                onChange={setRefunded}
                label="90-day refund — 50% chargeback"
                hint="Admin override. Resets Clean Streak."
              />
            ) : null}
          </fieldset>
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pain language, monthly spend, package"
            />
          </Field>
          {quote ? (
            <div className="rounded-md border border-border bg-raised px-3 py-3">
              <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                Engine · {formatQuoteLine(quote)}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatPay(quote.total)}</p>
              <p className="mt-1 text-xs text-muted">
                {editing ? "If you save these flags" : "If you hang this X"} · month{" "}
                {formatPay(quote.nextNet)} at {(quote.rate * 100).toFixed(0)}%
              </p>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 pt-2">
            {editing && onDelete ? (
              <Button type="button" variant="danger" onClick={onDelete} disabled={busy}>
                Pull X
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy || !ready} haptic="mark">
              {editing ? "Save" : "Hang the X"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          haptic("tick");
          onChange(e.target.checked);
        }}
        className="mt-1 size-4 accent-primary"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
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
