import { useEffect, useMemo, useRef } from "react";
import type { FloorAlert, Profile } from "@/lib/floor/types";
import { firstName } from "@/lib/floor/period";
import { haptic } from "@/lib/floor/haptics";

export function HungerStrip({
  me,
  alerts,
}: {
  me: Profile;
  alerts: FloorAlert[];
}) {
  const seen = useRef(new Set<number>());
  const mine = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.actorId !== me.userId &&
          (alert.targetId === me.userId || alert.targetId == null),
      ),
    [alerts, me.userId],
  );
  const headline = mine[0];

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const fresh = mine.filter((alert) => !seen.current.has(alert.id));
    if (fresh.length === 0) return;
    for (const alert of fresh) seen.current.add(alert.id);
    if (Notification.permission !== "granted") return;
    const alert = fresh[0];
    try {
      new Notification("SuperC Floor", { body: alert.message, tag: `floor-${alert.id}` });
      haptic("warn");
    } catch {
      /* notifications optional */
    }
  }, [mine]);

  if (!headline) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-3">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Hunt line</p>
        <p className="mt-1 text-sm text-muted">
          Board is even. First X of the day sets the pace, {firstName(me.displayName)}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-wb-bar/40 bg-surface px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-wb-bar uppercase">Stay hungry</p>
      <p className="mt-1 text-sm font-medium">{headline.message}</p>
      {mine.length > 1 ? (
        <ul className="mt-2 space-y-1">
          {mine.slice(1, 3).map((alert) => (
            <li key={alert.id} className="text-xs text-muted">
              {alert.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function requestHuntAlerts() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}
