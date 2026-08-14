import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { FollowUpStep, SequenceTask } from "@/lib/floor/types";
import { SEQUENCES, SEQUENCE_KEYS, sequenceOf, type SequenceKey } from "@/lib/floor/sequence";
import { formatShort, todayIso } from "@/lib/floor/period";
import { cn } from "@/lib/utils";

export function SequenceRail({
  steps,
  onComplete,
  onSkip,
  onEnroll,
  busy,
}: {
  steps: FollowUpStep[];
  onComplete: (id: number) => void;
  onSkip: (id: number) => void;
  onEnroll?: (key: SequenceKey) => void;
  busy?: boolean;
}) {
  const today = todayIso();
  const key = steps[0]?.sequenceKey;
  const def = sequenceOf(key);
  if (steps.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Sequence</p>
      <h2 className="mt-1 text-sm font-semibold">{def?.name ?? "Follow-up"}</h2>
      <p className="mt-1 text-xs text-muted">{def?.blurb}</p>
      <ol className="mt-4 space-y-2">
        {steps.map((step) => {
          const done = Boolean(step.doneAt);
          const skipped = Boolean(step.skippedAt);
          const due = !done && !skipped && step.dueOn <= today;
          const current = !done && !skipped && steps.every((s) => s.stepIndex >= step.stepIndex || s.doneAt || s.skippedAt);
          return (
            <li
              key={step.id}
              className={cn(
                "rounded-md border px-3 py-2",
                current ? "border-fg bg-raised" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={cn("text-sm font-medium", (done || skipped) && "text-muted")}>
                    {step.stepIndex + 1}. {step.title}
                  </p>
                  <p className="text-xs text-muted">
                    {done
                      ? "Done"
                      : skipped
                        ? "Skipped"
                        : due
                          ? `Due ${formatShort(step.dueOn)}`
                          : formatShort(step.dueOn)}
                  </p>
                </div>
                {current ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ink" disabled={busy} onClick={() => onSkip(step.id)}>
                      Skip
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => onComplete(step.id)}>
                      Done
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {onEnroll ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {SEQUENCE_KEYS.filter((k) => k !== key).map((k) => (
            <button
              key={k}
              type="button"
              disabled={busy}
              onClick={() => onEnroll(k)}
              className="rounded-sm px-2 py-1 text-[11px] text-muted hover:bg-raised hover:text-fg"
            >
              Switch to {SEQUENCES[k].name}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function SequenceTaskRow({
  task,
  onCall,
  onComplete,
  onSkip,
  busy,
}: {
  task: SequenceTask;
  onCall: () => void;
  onComplete: () => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  const today = todayIso();
  const overdue = task.dueOn < today;
  const def = sequenceOf(task.sequenceKey);
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link
          to="/crm/$customerId"
          params={{ customerId: String(task.customerId) }}
          className="text-sm font-medium hover:underline"
        >
          {task.customerName}
        </Link>
        <p className="text-xs text-muted">
          {def?.name ?? "Sequence"} · {task.stepIndex + 1}/{task.totalSteps} · {task.title}
        </p>
        <p className={cn("text-xs", overdue ? "text-warn" : "text-muted")}>
          {overdue ? "Overdue " : "Due "}
          {formatShort(task.dueOn)}
          {task.company ? ` · ${task.company}` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ink" disabled={busy} onClick={onSkip}>
          Skip
        </Button>
        <Button size="sm" variant="ink" disabled={busy} onClick={onComplete}>
          Done
        </Button>
        <Button size="sm" disabled={busy} onClick={onCall}>
          Call
        </Button>
      </div>
    </li>
  );
}
