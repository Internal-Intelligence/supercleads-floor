import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getDeskOps,
  getThread,
  replyThread,
  reviewBank,
  reviewTime,
  reviewW9,
} from "@/lib/floor/desk-server";
import { MSG_TOPIC, TIME_KIND, maskTin } from "@/lib/floor/desk";
import { formatShort } from "@/lib/floor/period";
import { cn } from "@/lib/utils";

export function AdminDeskOps() {
  const queryClient = useQueryClient();
  const ops = useQuery({ queryKey: ["desk-ops"], queryFn: () => getDeskOps() });
  const [view, setView] = useState<"w9" | "time" | "inbox">("w9");
  const [threadId, setThreadId] = useState<number | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["desk-ops"] });
    void queryClient.invalidateQueries({ queryKey: ["desk"] });
    void queryClient.invalidateQueries({ queryKey: ["floor"] });
    void queryClient.invalidateQueries({ queryKey: ["activity"] });
  };

  const w9Mut = useMutation({
    mutationFn: (data: { userId: string; status: "approved" | "returned"; adminNote?: string }) =>
      reviewW9({ data }),
    onSuccess: () => {
      toast.success("W-9 reviewed");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const bankMut = useMutation({
    mutationFn: (data: { userId: string; status: "approved" | "returned" }) => reviewBank({ data }),
    onSuccess: invalidate,
  });
  const timeMut = useMutation({
    mutationFn: (data: { id: number; status: "approved" | "denied"; adminNote?: string }) =>
      reviewTime({ data }),
    onSuccess: () => {
      toast.success("Request updated");
      invalidate();
    },
  });

  const thread = useQuery({
    queryKey: ["desk-thread", threadId],
    queryFn: () => getThread({ data: { threadId: threadId! } }),
    enabled: threadId != null,
  });
  const reply = useMutation({
    mutationFn: (body: string) => replyThread({ data: { threadId: threadId!, body } }),
    onSuccess: () => {
      void thread.refetch();
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!ops.data) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;

  const pendingW9 = ops.data.w9s.filter((w) => w.form.status === "submitted").length;
  const pendingTime = ops.data.time.filter((t) => t.status === "pending").length;
  const unread = ops.data.threads.reduce((n, t) => n + t.unread, 0);

  return (
    <div className="space-y-4">
      {ops.data.out.length > 0 ? (
        <section className="rounded-xl border border-warn/40 bg-surface p-4">
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Out today</p>
          <ul className="mt-2 space-y-1 text-sm">
            {ops.data.out.map((row) => (
              <li key={row.userId}>
                <span className="font-medium">{row.userName}</span>
                <span className="text-muted">
                  {" "}
                  · {row.status === "sick" ? "sick" : "off"}
                  {row.untilOn ? ` through ${formatShort(row.untilOn)}` : ""}
                  {row.note ? ` · ${row.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-1 overflow-x-auto rounded-sm bg-raised p-1">
        {(
          [
            ["w9", `W-9 / pay${pendingW9 ? ` (${pendingW9})` : ""}`],
            ["time", `Time${pendingTime ? ` (${pendingTime})` : ""}`],
            ["inbox", `Inbox${unread ? ` (${unread})` : ""}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              "h-11 shrink-0 rounded-sm px-3 text-sm font-medium",
              view === key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "w9" ? (
        <div className="space-y-3">
          {ops.data.w9s.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
              No W-9s yet. Reps file them on Desk.
            </p>
          ) : (
            ops.data.w9s.map((row) => (
              <article key={row.userId} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{row.userName}</p>
                    <p className="text-xs text-muted">{row.email}</p>
                  </div>
                  <Badge
                    tone={
                      row.form.status === "approved"
                        ? "pine"
                        : row.form.status === "submitted"
                          ? "warn"
                          : row.form.status === "returned"
                            ? "danger"
                            : "default"
                    }
                  >
                    {row.form.status}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] text-muted">Legal name</dt>
                    <dd>{row.form.legalName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Classification</dt>
                    <dd>{row.form.taxClass}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Address</dt>
                    <dd>
                      {[row.form.addressLine, row.form.city, row.form.state, row.form.zip]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">{row.form.tinType.toUpperCase()}</dt>
                    <dd className="font-mono text-xs">
                      {row.form.tinFull || maskTin(row.form.tinType, row.form.tinLast4)}
                    </dd>
                  </div>
                </dl>
                {row.form.status === "submitted" ? (
                  <form
                    className="mt-3 flex flex-col gap-2 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const note = String(new FormData(e.currentTarget).get("adminNote") ?? "");
                      w9Mut.mutate({ userId: row.userId, status: "approved" });
                      void note;
                    }}
                  >
                    <Input name="adminNote" placeholder="Return note (if sending back)" />
                    <Button type="submit" disabled={w9Mut.isPending}>
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="ink"
                      disabled={w9Mut.isPending}
                      onClick={(e) => {
                        const form = (e.currentTarget as HTMLButtonElement).form;
                        const note = form ? String(new FormData(form).get("adminNote") ?? "") : "";
                        if (!note.trim()) {
                          toast.error("Add a note when sending it back");
                          return;
                        }
                        w9Mut.mutate({ userId: row.userId, status: "returned", adminNote: note });
                      }}
                    >
                      Return
                    </Button>
                  </form>
                ) : null}
              </article>
            ))
          )}

          {ops.data.banks.length > 0 ? (
            <section className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium">Direct deposit</p>
              <ul className="mt-2 divide-y divide-border">
                {ops.data.banks.map((row) => (
                  <li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm font-medium">{row.userName}</p>
                      <p className="font-mono text-xs text-muted">
                        {row.bank.bankName} · {row.bank.accountType} · routing {row.routing} · acct{" "}
                        {row.account}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={row.bank.status === "approved" ? "pine" : "warn"}>{row.bank.status}</Badge>
                      {row.bank.status === "submitted" ? (
                        <Button
                          size="sm"
                          onClick={() => bankMut.mutate({ userId: row.userId, status: "approved" })}
                        >
                          Approve
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {view === "time" ? (
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          {ops.data.time.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No time requests.</p>
          ) : (
            <ul className="divide-y divide-border">
              {ops.data.time.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {row.userName} · {TIME_KIND[row.kind]}
                    </p>
                    <p className="text-xs text-muted">
                      {formatShort(row.startOn)}
                      {row.endOn !== row.startOn ? ` – ${formatShort(row.endOn)}` : ""}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        row.status === "approved" ? "pine" : row.status === "denied" ? "danger" : "warn"
                      }
                    >
                      {row.status}
                    </Badge>
                    {row.status === "pending" ? (
                      <>
                        <Button size="sm" onClick={() => timeMut.mutate({ id: row.id, status: "approved" })}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ink"
                          onClick={() => timeMut.mutate({ id: row.id, status: "denied" })}
                        >
                          Deny
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {view === "inbox" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">From the floor</p>
            {ops.data.threads.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Inbox is clean.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {ops.data.threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setThreadId(t.id)}
                      className="w-full py-3 text-left"
                    >
                      <p className="text-sm font-medium">
                        {t.userName} · {t.subject}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {MSG_TOPIC[t.topic]} · {t.preview}
                      </p>
                      {t.unread ? <Badge className="mt-1">New</Badge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-border bg-surface p-4">
            {!thread.data ? (
              <p className="py-10 text-center text-sm text-muted">Open a thread.</p>
            ) : (
              <>
                <h2 className="text-sm font-semibold">{thread.data.thread.subject}</h2>
                <p className="text-xs text-muted">{thread.data.thread.userName}</p>
                <ul className="mt-4 space-y-3">
                  {thread.data.messages.map((m) => (
                    <li key={m.id} className="rounded-md bg-raised px-3 py-2 text-sm">
                      <p className="text-[11px] text-muted">{m.authorName}</p>
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
                  <Textarea name="body" required placeholder="Reply" />
                  <Button type="submit" disabled={reply.isPending}>
                    Reply
                  </Button>
                </form>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
