import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SuperCMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  finishOnboarding,
  getDesk,
  saveBank,
  saveDeskProfile,
  saveW9,
  signDeskDocs,
} from "@/lib/floor/desk-server";
import {
  IC_COPY,
  PAY_PLAN_COPY,
  TAX_CLASS,
  buildChecklist,
  maskTin,
  type TaxClass,
} from "@/lib/floor/desk";
import { firstName } from "@/lib/floor/period";
import { haptic } from "@/lib/floor/haptics";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/floor/types";

const STEPS = [
  { key: "hello", label: "Welcome" },
  { key: "you", label: "You" },
  { key: "w9", label: "W-9" },
  { key: "bank", label: "Pay" },
  { key: "ic", label: "1099" },
  { key: "plan", label: "Plan" },
  { key: "send", label: "Send" },
] as const;

export function WelcomeWizard({ me, onDone }: { me: Profile; onDone: () => void }) {
  const queryClient = useQueryClient();
  const desk = useQuery({ queryKey: ["desk"], queryFn: () => getDesk() });
  const [step, setStep] = useState(0);
  const [taxClass, setTaxClass] = useState<TaxClass>("individual");
  const [tinType, setTinType] = useState<"ssn" | "ein">("ssn");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["desk"] });
  };

  const profileMut = useMutation({
    mutationFn: (data: Parameters<typeof saveDeskProfile>[0]["data"]) => saveDeskProfile({ data }),
    onSuccess: () => {
      haptic("tick");
      refresh();
      setStep(2);
    },
    onError: (e) => toast.error(e.message),
  });

  const w9Mut = useMutation({
    mutationFn: (data: Parameters<typeof saveW9>[0]["data"]) => saveW9({ data }),
    onSuccess: () => {
      haptic("tick");
      refresh();
      setStep(3);
    },
    onError: (e) => toast.error(e.message),
  });

  const bankMut = useMutation({
    mutationFn: (data: Parameters<typeof saveBank>[0]["data"]) => saveBank({ data }),
    onSuccess: () => {
      haptic("tick");
      refresh();
      setStep(4);
    },
    onError: (e) => toast.error(e.message),
  });

  const signMut = useMutation({
    mutationFn: (which: "ic" | "plan") => signDeskDocs({ data: { which } }),
    onSuccess: (_, which) => {
      haptic("tick");
      refresh();
      setStep(which === "ic" ? 5 : 6);
    },
    onError: (e) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: () => finishOnboarding(),
    onSuccess: () => {
      haptic("mark");
      toast.success("Packet is in teamconnect’s inbox");
      void queryClient.invalidateQueries({ queryKey: ["desk"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!desk.data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
        <div className="h-40 w-full max-w-md animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  const { profile, w9, bank } = desk.data;
  const checks = buildChecklist({ profile, w9, bank });
  const who = firstName(profile.displayName || me.displayName);
  const busy =
    profileMut.isPending || w9Mut.isPending || bankMut.isPending || signMut.isPending || sendMut.isPending;

  return (
    <div className="min-h-dvh bg-bg px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-fg">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col py-6">
        <SuperCMark />
        <ol className="mt-6 flex gap-1">
          {STEPS.map((s, i) => (
            <li key={s.key} className="min-w-0 flex-1">
              <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-raised")} />
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] font-medium tracking-[0.16em] text-muted uppercase">
          {STEPS[step].label} · {step + 1} / {STEPS.length}
        </p>

        <div className="mt-6 flex-1">
          {step === 0 ? (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight">Welcome to the floor, {who}.</h1>
              <p className="text-sm text-muted">
                SuperC-Leads pays 1099. Before you draw an X, file the legal packet. It goes
                straight to teamconnect@supercleads.com — W-9, deposit, contractor agreement, pay plan.
              </p>
              <ul className="space-y-2 text-sm">
                {checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2">
                    <span className={cn("mt-0.5 tabular-nums", c.done ? "text-pine" : "text-muted")}>
                      {c.done ? "✓" : "○"}
                    </span>
                    <span>
                      <span className="font-medium">{c.label}</span>
                      <span className="block text-xs text-muted">{c.hint}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => setStep(1)}>
                Let’s file it
              </Button>
            </div>
          ) : null}

          {step === 1 ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                profileMut.mutate({
                  displayName: String(f.get("displayName") ?? ""),
                  legalName: String(f.get("legalName") ?? ""),
                  phone: String(f.get("phone") ?? ""),
                  city: String(f.get("city") ?? ""),
                  emergencyName: String(f.get("emergencyName") ?? ""),
                  emergencyPhone: String(f.get("emergencyPhone") ?? ""),
                  monthlyGoal: Number(f.get("monthlyGoal") || profile.monthlyGoal),
                });
              }}
            >
              <h1 className="text-2xl font-semibold tracking-tight">Who you are on this floor</h1>
              <p className="text-sm text-muted">Name on the board, legal name for the 1099, and a number we can reach.</p>
              <Field label="Name on the board">
                <Input name="displayName" defaultValue={profile.displayName} required />
              </Field>
              <Field label="Legal name (tax return)">
                <Input name="legalName" defaultValue={profile.legalName} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input name="phone" type="tel" defaultValue={profile.phone} required />
                </Field>
                <Field label="City">
                  <Input name="city" defaultValue={profile.city} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Emergency contact">
                  <Input name="emergencyName" defaultValue={profile.emergencyName} />
                </Field>
                <Field label="Their phone">
                  <Input name="emergencyPhone" type="tel" defaultValue={profile.emergencyPhone} />
                </Field>
              </div>
              <Field label="Monthly X goal">
                <Input name="monthlyGoal" type="number" min={1} max={99} defaultValue={profile.monthlyGoal} />
              </Field>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="ink" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={busy}>
                  Next · W-9
                </Button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                w9Mut.mutate({
                  legalName: String(f.get("legalName") ?? ""),
                  businessName: String(f.get("businessName") ?? ""),
                  taxClass,
                  llcTaxClass: String(f.get("llcTaxClass") ?? ""),
                  addressLine: String(f.get("addressLine") ?? ""),
                  city: String(f.get("city") ?? ""),
                  state: String(f.get("state") ?? ""),
                  zip: String(f.get("zip") ?? ""),
                  tinType,
                  tin: String(f.get("tin") ?? ""),
                  certify: f.get("certify") === "on",
                  signatureName: String(f.get("signatureName") ?? ""),
                  submit: true,
                });
              }}
            >
              <h1 className="text-2xl font-semibold tracking-tight">Form W-9</h1>
              <p className="text-sm text-muted">
                Taxpayer ID for your 1099-NEC. This is not a W-4. TIN goes to admin only.
              </p>
              <Field label="Name as shown on your tax return">
                <Input name="legalName" defaultValue={w9?.legalName || profile.legalName} required />
              </Field>
              <Field label="Business name (if different)">
                <Input name="businessName" defaultValue={w9?.businessName ?? ""} />
              </Field>
              <Field label="Federal tax classification">
                <select
                  className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm"
                  value={taxClass}
                  onChange={(e) => setTaxClass(e.target.value as TaxClass)}
                >
                  {Object.entries(TAX_CLASS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              {taxClass === "llc" ? (
                <Field label="LLC taxed as (C / S / P)">
                  <Input name="llcTaxClass" defaultValue={w9?.llcTaxClass ?? ""} maxLength={1} />
                </Field>
              ) : null}
              <Field label="Address">
                <Input name="addressLine" defaultValue={w9?.addressLine ?? ""} required />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City">
                  <Input name="city" defaultValue={w9?.city || profile.city} required />
                </Field>
                <Field label="State">
                  <Input name="state" defaultValue={w9?.state ?? ""} maxLength={2} required />
                </Field>
                <Field label="ZIP">
                  <Input name="zip" defaultValue={w9?.zip ?? ""} required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="TIN">
                  <select
                    className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm"
                    value={tinType}
                    onChange={(e) => setTinType(e.target.value as "ssn" | "ein")}
                  >
                    <option value="ssn">SSN</option>
                    <option value="ein">EIN</option>
                  </select>
                </Field>
                <Field label={tinType === "ein" ? "EIN" : "SSN"}>
                  <Input
                    name="tin"
                    inputMode="numeric"
                    autoComplete="off"
                    required={!w9?.hasTin}
                    placeholder={w9?.hasTin ? maskTin(tinType, w9.tinLast4) : tinType === "ein" ? "XX-XXXXXXX" : "XXX-XX-XXXX"}
                  />
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="certify" defaultChecked className="mt-1 size-4" />
                <span>I certify the TIN is correct and I am a U.S. person (IRS W-9 Part II).</span>
              </label>
              <Field label="Sign — type your legal name">
                <Input name="signatureName" defaultValue={w9?.signatureName || profile.legalName} required />
              </Field>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="ink" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={busy}>
                  Submit W-9
                </Button>
              </div>
            </form>
          ) : null}

          {step === 3 ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                bankMut.mutate({
                  bankName: String(f.get("bankName") ?? ""),
                  accountType: String(f.get("accountType") ?? "checking") as "checking" | "savings",
                  holderName: String(f.get("holderName") ?? ""),
                  routing: String(f.get("routing") ?? ""),
                  account: String(f.get("account") ?? ""),
                  submit: true,
                });
              }}
            >
              <h1 className="text-2xl font-semibold tracking-tight">Where commission lands</h1>
              <p className="text-sm text-muted">ACH for your 1099 pay. Admin sees the full numbers. You see last four.</p>
              <Field label="Bank">
                <Input name="bankName" defaultValue={bank?.bankName ?? ""} required />
              </Field>
              <Field label="Account type">
                <select
                  name="accountType"
                  defaultValue={bank?.accountType || "checking"}
                  className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </Field>
              <Field label="Name on the account">
                <Input name="holderName" defaultValue={bank?.holderName || profile.legalName} required />
              </Field>
              <Field label="Routing number">
                <Input
                  name="routing"
                  inputMode="numeric"
                  required={!bank?.hasNumbers}
                  placeholder={bank?.routingLast4 ? `•••••${bank.routingLast4}` : "9 digits"}
                />
              </Field>
              <Field label="Account number">
                <Input
                  name="account"
                  inputMode="numeric"
                  required={!bank?.hasNumbers}
                  placeholder={bank?.accountLast4 ? `••••${bank.accountLast4}` : "Account number"}
                />
              </Field>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="ink" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={busy}>
                  Submit deposit
                </Button>
              </div>
            </form>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight">Independent contractor</h1>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-surface p-4 text-sm leading-relaxed">
                {IC_COPY}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ink" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => signMut.mutate("ic")}
                >
                  {profile.icSignedAt ? "Signed · continue" : "I agree — sign"}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight">The pay plan</h1>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-surface p-4 text-sm leading-relaxed">
                {PAY_PLAN_COPY}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ink" onClick={() => setStep(4)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => signMut.mutate("plan")}
                >
                  {profile.payPlanSignedAt ? "Signed · continue" : "I understand — sign"}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight">Send it to teamconnect</h1>
              <p className="text-sm text-muted">
                This writes one packet to the admin inbox. They review W-9 and deposit. You hit the board.
              </p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {checks.map((c) => (
                  <li key={c.key} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{c.label}</span>
                    <span className={c.done ? "text-pine" : "text-warn"}>{c.done ? "Ready" : "Missing"}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button type="button" variant="ink" onClick={() => setStep(5)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy || checks.some((c) => !c.done)}
                  onClick={() => sendMut.mutate()}
                >
                  Send packet
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
