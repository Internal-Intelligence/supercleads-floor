import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FloorGate } from "@/components/gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  callInSick,
  cancelTimeRequest,
  getDesk,
  getThread,
  replyThread,
  requestTimeOff,
  saveBank,
  saveDeskProfile,
  saveW9,
  setPresence,
  signDeskDocs,
  startThread,
} from "@/lib/floor/desk-server";
import {
  buildChecklist,
  IC_COPY,
  MSG_TOPIC,
  PAY_PLAN_COPY,
  TAX_CLASS,
  TIME_KIND,
  maskTin,
  type MsgTopic,
  type TaxClass,
  type TimeKind,
} from "@/lib/floor/desk";
import { formatShort, todayIso } from "@/lib/floor/period";
import { haptic } from "@/lib/floor/haptics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/desk")({ component: DeskPage });

function DeskPage() {
  return <FloorGate>{() => <Desk />}</FloorGate>;
}

type Tab = "home" | "profile" | "tax" | "time" | "inbox";

function Desk() {
  const queryClient = useQueryClient();
  const desk = useQuery({ queryKey: ["desk"], queryFn: () => getDesk() });
  const [tab, setTab] = useState<Tab>("home");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["desk"] });
    void queryClient.invalidateQueries({ queryKey: ["floor"] });
    void queryClient.invalidateQueries({ queryKey: ["day"] });
    void queryClient.invalidateQueries({ queryKey: ["team"] });
  };

  if (!desk.data) return <div className="h-80 animate-pulse rounded-xl bg-surface" />;

  const { profile, w9, bank, time, presence, threads, unread } = desk.data;
  const checks = buildChecklist({ profile, w9, bank });
  const ready = checks.every((c) => c.done);
  const doneCount = checks.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
            SuperC-Leads · 1099 desk
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your desk</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Build it out, file the W-9, get paid. This is your contractor file — not an employee
            handbook.
          </p>
        </div>
        <Badge tone={ready ? "pine" : "warn"}>
          {ready ? "Ready to sell" : `${doneCount} / ${checks.length} to get paid`}
        </Badge>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-sm bg-raised p-1">
        {(
          [
            ["home", "Start"],
            ["profile", "Profile"],
            ["tax", "W-9 & pay"],
            ["time", "Time"],
            ["inbox", unread ? `Admin (${unread})` : "Admin"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              haptic("tap");
              setTab(key);
            }}
            className={cn(
              "h-11 shrink-0 rounded-sm px-3 text-sm font-medium",
              tab === key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "home" ? (
        <Home
          checks={checks}
          presence={presence}
          onOpen={setTab}
          onSick={() => setTab("time")}
          onBack={() => invalidate()}
        />
      ) : null}
      {tab === "profile" ? <ProfileForm profile={profile} onSaved={invalidate} /> : null}
      {tab === "tax" ? (
        <TaxPay profile={profile} w9={w9} bank={bank} onSaved={invalidate} />
      ) : null}
      {tab === "time" ? (
        <TimeDesk
          time={time}
          presence={presence}
          onSaved={invalidate}
        />
      ) : null}
      {tab === "inbox" ? <Inbox threads={threads} onSaved={invalidate} /> : null}
    </div>
  );
}

function Home({
  checks,
  presence,
  onOpen,
  onSick,
  onBack,
}: {
  checks: ReturnType<typeof buildChecklist>;
  presence: { status: string; note: string; untilOn: string | null };
  onOpen: (tab: Tab) => void;
  onSick: () => void;
  onBack: () => void;
}) {
  const back = useMutation({
    mutationFn: () => setPresence({ data: { status: "on" } }),
    onSuccess: () => {
      toast.success("You're back on the floor");
      onBack();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {presence.status !== "on" ? (
        <section className="rounded-xl border border-warn/40 bg-surface p-4">
          <p className="text-sm font-medium">
            {presence.status === "sick" ? "You're called out sick" : "You're marked off the floor"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {presence.note || "The board shows you out."}
            {presence.untilOn ? ` · through ${formatShort(presence.untilOn)}` : ""}
          </p>
          <Button className="mt-3" variant="ink" onClick={() => back.mutate()} disabled={back.isPending}>
            I'm back
          </Button>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">To start work</p>
        <ul className="mt-3 divide-y divide-border">
          {checks.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted">{item.hint}</p>
              </div>
              <Badge tone={item.done ? "pine" : "default"}>{item.done ? "Done" : "Open"}</Badge>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
          <Button variant="ink" onClick={() => onOpen("profile")}>
            Profile
          </Button>
          <Button onClick={() => onOpen("tax")}>File W-9</Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSick}
          className="rounded-xl border border-border bg-surface p-4 text-left hover:border-fg/20"
        >
          <p className="text-sm font-medium">Call in sick</p>
          <p className="mt-1 text-xs text-muted">Marks you out on the board. Admin sees it now.</p>
        </button>
        <button
          type="button"
          onClick={() => onOpen("time")}
          className="rounded-xl border border-border bg-surface p-4 text-left hover:border-fg/20"
        >
          <p className="text-sm font-medium">Request days off</p>
          <p className="mt-1 text-xs text-muted">Pending until teamconnect approves.</p>
        </button>
        <button
          type="button"
          onClick={() => onOpen("inbox")}
          className="rounded-xl border border-border bg-surface p-4 text-left hover:border-fg/20"
        >
          <p className="text-sm font-medium">Write admin</p>
          <p className="mt-1 text-xs text-muted">Payroll, schedule, tax, leads — one thread.</p>
        </button>
        <button
          type="button"
          onClick={() => onOpen("tax")}
          className="rounded-xl border border-border bg-surface p-4 text-left hover:border-fg/20"
        >
          <p className="text-sm font-medium">Direct deposit</p>
          <p className="mt-1 text-xs text-muted">Where the commission check lands.</p>
        </button>
      </section>
    </div>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: {
    displayName: string;
    legalName: string;
    phone: string;
    city: string;
    bio: string;
    emergencyName: string;
    emergencyPhone: string;
    workHours: string;
    monthlyGoal: number;
    email: string | null;
  };
  onSaved: () => void;
}) {
  const save = useMutation({
    mutationFn: (form: FormData) =>
      saveDeskProfile({
        data: {
          displayName: String(form.get("displayName") ?? ""),
          legalName: String(form.get("legalName") ?? ""),
          phone: String(form.get("phone") ?? ""),
          city: String(form.get("city") ?? ""),
          bio: String(form.get("bio") ?? ""),
          emergencyName: String(form.get("emergencyName") ?? ""),
          emergencyPhone: String(form.get("emergencyPhone") ?? ""),
          workHours: String(form.get("workHours") ?? ""),
          monthlyGoal: Number(form.get("monthlyGoal") || profile.monthlyGoal),
        },
      }),
    onSuccess: () => {
      haptic("tick");
      toast.success("Desk profile saved");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">How you show up</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name on the board">
          <Input name="displayName" defaultValue={profile.displayName} required />
        </Field>
        <Field label="Legal name">
          <Input name="legalName" defaultValue={profile.legalName} placeholder="As on your tax return" />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={profile.phone} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={profile.city} />
        </Field>
        <Field label="Hours you usually hunt">
          <Input name="workHours" defaultValue={profile.workHours} placeholder="Mon–Fri 8–5 CT" />
        </Field>
        <Field label="Monthly X goal">
          <Input name="monthlyGoal" type="number" min={1} max={99} defaultValue={profile.monthlyGoal} />
        </Field>
      </div>
      <Field label="Short bio — on your liking">
        <Textarea name="bio" defaultValue={profile.bio} placeholder="Closer. Little Rock. I take every inbound." />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Emergency contact">
          <Input name="emergencyName" defaultValue={profile.emergencyName} />
        </Field>
        <Field label="Emergency phone">
          <Input name="emergencyPhone" type="tel" defaultValue={profile.emergencyPhone} />
        </Field>
      </div>
      <p className="text-xs text-subtle">Login stays {profile.email || "your account email"}.</p>
      <Button type="submit" disabled={save.isPending}>
        Save profile
      </Button>
    </form>
  );
}

function TaxPay({
  profile,
  w9,
  bank,
  onSaved,
}: {
  profile: { legalName: string; icSignedAt: string | null; payPlanSignedAt: string | null };
  w9: ReturnType<typeof buildChecklist> extends never ? never : import("@/lib/floor/desk").W9Public | null;
  bank: import("@/lib/floor/desk").BankPublic | null;
  onSaved: () => void;
}) {
  const [taxClass, setTaxClass] = useState<TaxClass>(w9?.taxClass ?? "individual");
  const [tinType, setTinType] = useState<"ssn" | "ein">(w9?.tinType ?? "ssn");
  const sign = useMutation({
    mutationFn: (which: "ic" | "plan") => signDeskDocs({ data: { which } }),
    onSuccess: () => {
      toast.success("Signed");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const w9Mut = useMutation({
    mutationFn: (payload: Parameters<typeof saveW9>[0]["data"]) => saveW9({ data: payload }),
    onSuccess: (_, vars) => {
      toast.success(vars.submit ? "W-9 submitted to teamconnect" : "W-9 draft saved");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const bankMut = useMutation({
    mutationFn: (payload: Parameters<typeof saveBank>[0]["data"]) => saveBank({ data: payload }),
    onSuccess: (_, vars) => {
      toast.success(vars.submit ? "Deposit info submitted" : "Deposit draft saved");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Form W-9</p>
            <p className="text-xs text-muted">
              Request for Taxpayer Identification Number. SuperC uses this to pay you and file
              1099-NEC. Not an employee W-4.
            </p>
          </div>
          <Badge
            tone={
              w9?.status === "approved" ? "pine" : w9?.status === "returned" ? "danger" : w9?.status === "submitted" ? "warn" : "default"
            }
          >
            {w9?.status ?? "not started"}
          </Badge>
        </div>
        {w9?.adminNote ? <p className="mt-2 text-sm text-warn">{w9.adminNote}</p> : null}
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const submit = (e.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement
              && (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "submit";
            w9Mut.mutate({
              legalName: String(f.get("legalName") ?? ""),
              businessName: String(f.get("businessName") ?? ""),
              taxClass,
              llcTaxClass: String(f.get("llcTaxClass") ?? ""),
              exemptPayeeCode: String(f.get("exemptPayeeCode") ?? ""),
              fatcaCode: String(f.get("fatcaCode") ?? ""),
              addressLine: String(f.get("addressLine") ?? ""),
              city: String(f.get("city") ?? ""),
              state: String(f.get("state") ?? ""),
              zip: String(f.get("zip") ?? ""),
              tinType,
              tin: String(f.get("tin") ?? ""),
              certify: f.get("certify") === "on",
              signatureName: String(f.get("signatureName") ?? ""),
              submit,
            });
          }}
        >
          <Field label="1. Name (as on tax return)">
            <Input name="legalName" defaultValue={w9?.legalName || profile.legalName} required />
          </Field>
          <Field label="2. Business name / disregarded entity">
            <Input name="businessName" defaultValue={w9?.businessName ?? ""} />
          </Field>
          <Field label="3. Federal tax classification">
            <select
              className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm"
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
            <Field label="LLC tax classification (C / S / P)">
              <Input name="llcTaxClass" defaultValue={w9?.llcTaxClass ?? ""} maxLength={1} />
            </Field>
          ) : null}
          <Field label="5. Address (number, street, apt)">
            <Input name="addressLine" defaultValue={w9?.addressLine ?? ""} />
          </Field>
          <Field label="6. City">
            <Input name="city" defaultValue={w9?.city ?? ""} />
          </Field>
          <Field label="State">
            <Input name="state" defaultValue={w9?.state ?? ""} maxLength={2} />
          </Field>
          <Field label="ZIP">
            <Input name="zip" defaultValue={w9?.zip ?? ""} />
          </Field>
          <Field label="TIN type">
            <select
              className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm"
              value={tinType}
              onChange={(e) => setTinType(e.target.value as "ssn" | "ein")}
            >
              <option value="ssn">SSN</option>
              <option value="ein">EIN</option>
            </select>
          </Field>
          <Field label={tinType === "ein" ? "Employer identification number" : "Social security number"}>
            <Input
              name="tin"
              inputMode="numeric"
              autoComplete="off"
              placeholder={w9?.hasTin ? maskTin(tinType, w9.tinLast4) : tinType === "ein" ? "XX-XXXXXXX" : "XXX-XX-XXXX"}
            />
          </Field>
          <label className="sm:col-span-2 flex items-start gap-2 text-sm">
            <input type="checkbox" name="certify" defaultChecked={w9?.certify} className="mt-1 size-4" />
            <span>
              I certify the TIN is correct, I am a U.S. person, and I am not subject to backup
              withholding (IRS W-9 Part II).
            </span>
          </label>
          <Field label="Signature (type your legal name)">
            <Input name="signatureName" defaultValue={w9?.signatureName ?? ""} />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" variant="ink" value="draft" disabled={w9Mut.isPending}>
              Save draft
            </Button>
            <Button type="submit" value="submit" disabled={w9Mut.isPending || w9?.status === "approved"}>
              Submit W-9
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Direct deposit</p>
            <p className="text-xs text-muted">Commission ACH. Numbers are stored for payroll and shown as last four.</p>
          </div>
          <Badge tone={bank?.status === "approved" ? "pine" : bank?.status === "submitted" ? "warn" : "default"}>
            {bank?.status ?? "not started"}
          </Badge>
        </div>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const submit =
              (e.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement &&
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "submit";
            bankMut.mutate({
              bankName: String(f.get("bankName") ?? ""),
              accountType: String(f.get("accountType") ?? "checking") as "checking" | "savings",
              holderName: String(f.get("holderName") ?? ""),
              routing: String(f.get("routing") ?? ""),
              account: String(f.get("account") ?? ""),
              submit,
            });
          }}
        >
          <Field label="Bank">
            <Input name="bankName" defaultValue={bank?.bankName ?? ""} />
          </Field>
          <Field label="Account type">
            <select
              name="accountType"
              defaultValue={bank?.accountType || "checking"}
              className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm"
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </Field>
          <Field label="Name on the account">
            <Input name="holderName" defaultValue={bank?.holderName || profile.legalName} />
          </Field>
          <Field label="Routing number">
            <Input
              name="routing"
              inputMode="numeric"
              placeholder={bank?.routingLast4 ? `•••••${bank.routingLast4}` : "9 digits"}
            />
          </Field>
          <Field label="Account number">
            <Input
              name="account"
              inputMode="numeric"
              placeholder={bank?.accountLast4 ? `••••${bank.accountLast4}` : "Account number"}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" variant="ink" value="draft" disabled={bankMut.isPending}>
              Save draft
            </Button>
            <Button type="submit" value="submit" disabled={bankMut.isPending}>
              Submit deposit
            </Button>
          </div>
        </form>
      </section>

      <DocCard
        title="Independent contractor agreement"
        body={IC_COPY}
        signed={Boolean(profile.icSignedAt)}
        busy={sign.isPending}
        onSign={() => sign.mutate("ic")}
      />
      <DocCard
        title="Pay plan acknowledgment"
        body={PAY_PLAN_COPY}
        signed={Boolean(profile.payPlanSignedAt)}
        busy={sign.isPending}
        onSign={() => sign.mutate("plan")}
      />
    </div>
  );
}

function TimeDesk({
  time,
  presence,
  onSaved,
}: {
  time: import("@/lib/floor/desk").TimeRequest[];
  presence: { status: string; untilOn: string | null };
  onSaved: () => void;
}) {
  const off = useMutation({
    mutationFn: (f: FormData) =>
      requestTimeOff({
        data: {
          kind: String(f.get("kind") || "vacation") as TimeKind,
          startOn: String(f.get("startOn") ?? ""),
          endOn: String(f.get("endOn") ?? ""),
          note: String(f.get("note") ?? ""),
        },
      }),
    onSuccess: () => {
      toast.success("Request sent to teamconnect");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const sick = useMutation({
    mutationFn: (f: FormData) =>
      callInSick({
        data: {
          note: String(f.get("sickNote") ?? ""),
          untilOn: String(f.get("untilOn") ?? "") || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Called out. The board shows you sick.");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => cancelTimeRequest({ data: { id } }),
    onSuccess: onSaved,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Call in sick</p>
        <p className="mt-1 text-xs text-muted">
          Instant. No approval wait. Your column reads Out until you come back.
        </p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            sick.mutate(new FormData(e.currentTarget));
          }}
        >
          <Field label="Out through">
            <Input name="untilOn" type="date" defaultValue={todayIso()} />
          </Field>
          <Field label="Note for admin">
            <Input name="sickNote" placeholder="Flu. Back Thursday." />
          </Field>
          <Button type="submit" disabled={sick.isPending || presence.status === "sick"}>
            Call in sick
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Request days off</p>
        <p className="mt-1 text-xs text-muted">Vacation, personal, unpaid. Admin approves before it hits the board.</p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            off.mutate(new FormData(e.currentTarget));
          }}
        >
          <Field label="Type">
            <select name="kind" className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm">
              <option value="vacation">Days off</option>
              <option value="personal">Personal</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From">
              <Input name="startOn" type="date" required />
            </Field>
            <Field label="Through">
              <Input name="endOn" type="date" required />
            </Field>
          </div>
          <Field label="Note">
            <Input name="note" placeholder="Family in town" />
          </Field>
          <Button type="submit" variant="ink" disabled={off.isPending}>
            Send request
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 lg:col-span-2">
        <p className="text-sm font-medium">Your requests</p>
        {time.length === 0 ? (
          <p className="py-8 text-sm text-muted">Nothing on the calendar.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {time.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {TIME_KIND[row.kind]} · {formatShort(row.startOn)}
                    {row.endOn !== row.startOn ? ` – ${formatShort(row.endOn)}` : ""}
                  </p>
                  <p className="text-xs text-muted">{row.note || row.adminNote || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      row.status === "approved" ? "pine" : row.status === "denied" ? "danger" : "default"
                    }
                  >
                    {row.status}
                  </Badge>
                  {row.status === "pending" ? (
                    <Button size="sm" variant="ink" onClick={() => cancel.mutate(row.id)}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Inbox({
  threads,
  onSaved,
}: {
  threads: import("@/lib/floor/desk").DeskThread[];
  onSaved: () => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const thread = useQuery({
    queryKey: ["desk-thread", openId],
    queryFn: () => getThread({ data: { threadId: openId! } }),
    enabled: openId != null,
  });
  const start = useMutation({
    mutationFn: (f: FormData) =>
      startThread({
        data: {
          topic: String(f.get("topic") || "other") as MsgTopic,
          subject: String(f.get("subject") ?? ""),
          body: String(f.get("body") ?? ""),
        },
      }),
    onSuccess: (res) => {
      toast.success("Sent to teamconnect");
      setOpenId(res.id);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const reply = useMutation({
    mutationFn: (body: string) => replyThread({ data: { threadId: openId!, body } }),
    onSuccess: () => {
      void thread.refetch();
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        {openId && thread.data ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setOpenId(null)}>
              All threads
            </button>
            <h2 className="mt-2 text-sm font-semibold">{thread.data.thread.subject}</h2>
            <p className="text-xs text-muted">{MSG_TOPIC[thread.data.thread.topic]}</p>
            <ul className="mt-4 space-y-3">
              {thread.data.messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm",
                    m.mine ? "ml-6 bg-raised" : "mr-6 border border-border",
                  )}
                >
                  <p className="text-[11px] text-muted">
                    {m.authorName} ·{" "}
                    {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ul>
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                reply.mutate(String(f.get("body") ?? ""));
                e.currentTarget.reset();
              }}
            >
              <Textarea name="body" placeholder="Reply to admin" required />
              <Button type="submit" disabled={reply.isPending}>
                Send
              </Button>
            </form>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">Write teamconnect</p>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                start.mutate(new FormData(e.currentTarget));
                e.currentTarget.reset();
              }}
            >
              <Field label="Topic">
                <select name="topic" className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm">
                  {Object.entries(MSG_TOPIC).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subject">
                <Input name="subject" required placeholder="Deposit didn't land" />
              </Field>
              <Field label="Message">
                <Textarea name="body" required placeholder="What do you need?" />
              </Field>
              <Button type="submit" disabled={start.isPending}>
                Send to admin
              </Button>
            </form>
          </section>
        )}
      </div>
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Threads</p>
        {threads.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No messages yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="w-full py-3 text-left"
                >
                  <p className="text-sm font-medium">{t.subject}</p>
                  <p className="truncate text-xs text-muted">{t.preview}</p>
                  {t.unread ? <Badge className="mt-1">New</Badge> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DocCard({
  title,
  body,
  signed,
  busy,
  onSign,
}: {
  title: string;
  body: string;
  signed: boolean;
  busy: boolean;
  onSign: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge tone={signed ? "pine" : "default"}>{signed ? "Signed" : "Unsigned"}</Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{body}</p>
      {!signed ? (
        <Button className="mt-4" onClick={onSign} disabled={busy}>
          I agree — sign
        </Button>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}
