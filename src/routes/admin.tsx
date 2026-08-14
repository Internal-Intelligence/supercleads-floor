import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ConversionCard, ConversionTable } from "@/components/conversion-card";
import { FloorGate } from "@/components/gate";
import { AdminDeskOps } from "@/components/admin-desk";
import { OverrideConfirm, type OverrideDraft } from "@/components/override-confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getConversion, listActivity, listTeam, updateTeammate } from "@/lib/floor/server";
import { firstName } from "@/lib/floor/period";
import type { FloorRole } from "@/lib/floor/types";
import { formatPay } from "@/lib/floor/pay";
import { haptic } from "@/lib/floor/haptics";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  return (
    <FloorGate>
      {(me) => (me.role === "admin" ? <AdminDesk /> : <Navigate to="/" />)}
    </FloorGate>
  );
}

function AdminDesk() {
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: () => listTeam() });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => listActivity() });
  const [confirm, setConfirm] = useState<OverrideDraft | null>(null);
  const [pane, setPane] = useState<"seats" | "desk" | "rates">("seats");
  const conversion = useQuery({
    queryKey: ["conversion"],
    queryFn: () => getConversion({ data: { period: "month" } }),
  });

  const mutate = useMutation({
    mutationFn: (data: {
      userId: string;
      displayName?: string;
      role?: FloorRole;
      monthlyGoal?: number;
      active?: boolean;
    }) => updateTeammate({ data }),
    onSuccess: (_, data) => {
      haptic("tick");
      const person = team.data?.people.find((p) => p.userId === data.userId);
      const who = person ? firstName(person.displayName) : "Rep";
      if (data.monthlyGoal != null) toast.success(`Goal override · ${who} is now ${data.monthlyGoal}`);
      else if (data.role) toast.success(`${who} is now ${data.role === "admin" ? "admin" : "sales"}`);
      else if (data.active === false) toast.success(`${who} paused · they cannot post`);
      else if (data.active === true) toast.success(`${who} restored to the floor`);
      else if (data.displayName) toast.success(`Name override saved · ${data.displayName}`);
      else toast.success("Override saved");
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      void queryClient.invalidateQueries({ queryKey: ["floor"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (err) => {
      haptic("error");
      toast.error(err.message);
    },
  });

  if (!team.data) return <div className="h-80 animate-pulse rounded-xl bg-surface" />;

  const meId = team.data.me.userId;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
          SuperC-Leads · Admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Floor control</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Override seats, review W-9s, approve time, and answer the floor.
        </p>
      </div>

      <div className="flex gap-1 rounded-sm bg-raised p-1">
        <button
          type="button"
          onClick={() => setPane("seats")}
          className={`h-11 flex-1 rounded-sm text-sm font-medium ${pane === "seats" ? "bg-primary text-primary-fg" : "text-muted"}`}
        >
          Seats
        </button>
        <button
          type="button"
          onClick={() => setPane("desk")}
          className={`h-11 flex-1 rounded-sm text-sm font-medium ${pane === "desk" ? "bg-primary text-primary-fg" : "text-muted"}`}
        >
          Desk ops
        </button>
        <button
          type="button"
          onClick={() => setPane("rates")}
          className={`h-11 flex-1 rounded-sm text-sm font-medium ${pane === "rates" ? "bg-primary text-primary-fg" : "text-muted"}`}
        >
          Rates
        </button>
      </div>

      {pane === "desk" ? <AdminDeskOps /> : null}
      {pane === "rates" ? (
        conversion.data ? (
          <div className="space-y-4">
            <ConversionCard mine={conversion.data.floor} />
            <ConversionTable people={conversion.data.people} meId={meId} />
          </div>
        ) : (
          <div className="h-48 animate-pulse rounded-xl bg-surface" />
        )
      ) : null}
      {pane === "seats" ? (
        <>

      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Override workflow</p>
        <ol className="mt-3 space-y-3 text-sm">
          <li>
            <span className="font-medium">1. Seat</span>
            <span className="text-muted">
              {" "}
              — pick the rep. Change their name, monthly goal, or pause the seat. Goal override
              replaces whatever they set on My Day. Role is locked: teamconnect@supercleads.com is
              the only admin.
            </span>
          </li>
          <li>
            <span className="font-medium">2. Board</span>
            <span className="text-muted">
              {" "}
              — tap Draw their X. The pad opens on their column. That close is theirs for pay and rank.
            </span>
          </li>
          <li>
            <span className="font-medium">3. Pull</span>
            <span className="text-muted">
              {" "}
              — on the board, tap any X and Pull X. Refunds are a 50% chargeback on their statement.
            </span>
          </li>
        </ol>
      </section>

      <section className="space-y-3 md:hidden">
        {team.data.people.map((person) => (
          <SeatCard
            key={person.userId}
            person={person}
            self={person.userId === meId}
            onAsk={setConfirm}
            onSave={(data) => mutate.mutate({ userId: person.userId, ...data })}
          />
        ))}
      </section>

      <section className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-border text-[11px] tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Rep</th>
              <th className="px-4 py-3 font-medium">Seat</th>
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 font-medium">Pay</th>
              <th className="px-4 py-3 font-medium">Goal</th>
              <th className="px-4 py-3 font-medium">Seat</th>
              <th className="px-4 py-3 font-medium">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {team.data.people.map((person) => (
              <tr key={person.userId}>
                <td className="px-4 py-3">
                  <NameField
                    value={person.displayName}
                    email={person.email}
                    onSave={(displayName) =>
                      setConfirm({
                        title: `Override name · ${firstName(person.displayName)}`,
                        body: `Board column becomes “${displayName}”. Their login email stays ${person.email || "the same"}.`,
                        action: "Save name",
                        run: () => mutate.mutate({ userId: person.userId, displayName }),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <Badge tone={person.role === "admin" ? "pine" : "default"}>
                    {person.role === "admin" ? "Admin · teamconnect" : "Sales"}
                  </Badge>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted">
                  {person.todaySales} today · {person.monthSales} mo · {person.monthCalls} calls
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium tabular-nums">{formatPay(person.monthPay)}</p>
                  <p className="text-[11px] text-subtle">
                    {person.tierLabel} · {(person.tierRate * 100).toFixed(0)}%
                  </p>
                </td>
                <td className="px-4 py-3">
                  <GoalField
                    key={`${person.userId}-${person.monthlyGoal}`}
                    value={person.monthlyGoal}
                    onSave={(monthlyGoal) =>
                      setConfirm({
                        title: `Override goal · ${firstName(person.displayName)}`,
                        body: `Replace their My Day goal (${person.monthlyGoal}) with ${monthlyGoal}. Target on the board updates now.`,
                        action: `Set ${monthlyGoal}`,
                        run: () => mutate.mutate({ userId: person.userId, monthlyGoal }),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={person.active ? "pine" : "danger"}>
                      {person.active ? "On floor" : "Paused"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ink"
                      disabled={person.userId === meId}
                      onClick={() =>
                        setConfirm({
                          title: person.active
                            ? `Pause ${firstName(person.displayName)}`
                            : `Restore ${firstName(person.displayName)}`,
                          body: person.active
                            ? "They stay signed in but cannot post an X until you restore the seat."
                            : "They get their column back and can post again.",
                          action: person.active ? "Pause seat" : "Restore seat",
                          danger: person.active,
                          run: () =>
                            mutate.mutate({ userId: person.userId, active: !person.active }),
                        })
                      }
                    >
                      {person.active ? "Pause" : "Restore"}
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ink" asChild>
                    <a href={`/?for=${encodeURIComponent(person.userId)}`}>Draw their X</a>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Floor log</h2>
        <p className="mb-3 text-xs text-muted">Every override is stamped with your name.</p>
        {(activity.data ?? []).length === 0 ? (
          <p className="py-6 text-sm text-muted">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.data?.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                <p className="text-sm">
                  <span className="font-medium">{row.actorName}</span>{" "}
                  <span className="text-muted">{row.action}</span>
                  {row.detail ? <span className="text-muted"> · {row.detail}</span> : null}
                </p>
                <p className="text-xs text-subtle">
                  {new Date(row.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      ) : null}

      <OverrideConfirm
        draft={confirm}
        busy={mutate.isPending}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function SeatCard({
  person,
  self,
  onAsk,
  onSave,
}: {
  person: {
    userId: string;
    displayName: string;
    email: string | null;
    role: FloorRole;
    monthlyGoal: number;
    active: boolean;
    todaySales: number;
    monthSales: number;
    monthCalls: number;
    monthPay: number;
    tierLabel: string;
    tierRate: number;
  };
  self: boolean;
  onAsk: (draft: OverrideDraft) => void;
  onSave: (data: {
    displayName?: string;
    role?: FloorRole;
    monthlyGoal?: number;
    active?: boolean;
  }) => void;
}) {
  const who = firstName(person.displayName);
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <NameField
        value={person.displayName}
        email={person.email}
        onSave={(displayName) =>
          onAsk({
            title: `Override name · ${who}`,
            body: `Board column becomes “${displayName}”.`,
            action: "Save name",
            run: () => onSave({ displayName }),
          })
        }
      />
      <p className="mt-2 text-sm tabular-nums">
        {formatPay(person.monthPay)}
        <span className="ml-2 text-xs text-muted">
          {person.tierLabel} · {(person.tierRate * 100).toFixed(0)}%
        </span>
      </p>
      <p className="mt-2 text-xs text-muted">
        {person.role === "admin" ? "Admin · teamconnect" : "Sales"}
        {" · "}
        {person.todaySales} today · {person.monthSales} mo · {person.monthCalls} calls
      </p>
      <div className="mt-3">
        <label className="block space-y-1">
          <span className="text-[11px] text-muted">Goal</span>
          <GoalField
            key={`${person.userId}-${person.monthlyGoal}`}
            value={person.monthlyGoal}
            onSave={(monthlyGoal) =>
              onAsk({
                title: `Override goal · ${who}`,
                body: `Replace their My Day goal (${person.monthlyGoal}) with ${monthlyGoal}.`,
                action: `Set ${monthlyGoal}`,
                run: () => onSave({ monthlyGoal }),
              })
            }
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Badge tone={person.active ? "pine" : "danger"}>
          {person.active ? "On floor" : "Paused"}
        </Badge>
        <div className="flex gap-2">
          <Button size="sm" className="min-h-11" variant="ink" asChild>
            <a href={`/?for=${encodeURIComponent(person.userId)}`}>Draw their X</a>
          </Button>
          <Button
            size="sm"
            className="min-h-11"
            variant="ink"
            disabled={self}
            onClick={() =>
              onAsk({
                title: person.active ? `Pause ${who}` : `Restore ${who}`,
                body: person.active
                  ? "They cannot post an X until you restore the seat."
                  : "They get their column back.",
                action: person.active ? "Pause seat" : "Restore seat",
                danger: person.active,
                run: () => onSave({ active: !person.active }),
              })
            }
          >
            {person.active ? "Pause" : "Restore"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function NameField({
  value,
  email,
  onSave,
}: {
  value: string;
  email: string | null;
  onSave: (name: string) => void;
}) {
  return (
    <div>
      <Input
        defaultValue={value}
        className="h-11"
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next && next !== value) onSave(next);
        }}
      />
      <p className="mt-1 text-[11px] text-subtle">{email || "No email"}</p>
    </div>
  );
}

function GoalField({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  return (
    <Input
      type="number"
      min={1}
      max={99}
      defaultValue={value}
      className="h-11 w-full"
      onBlur={(e) => {
        const next = Number(e.target.value);
        if (Number.isFinite(next) && next !== value) onSave(next);
      }}
    />
  );
}
