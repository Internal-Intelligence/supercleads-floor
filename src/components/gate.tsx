import { useEffect, useState, type ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bootstrapFloor } from "@/lib/floor/server";
import { getDesk } from "@/lib/floor/desk-server";
import { isFloorAdminEmail } from "@/lib/floor/admin";
import type { Profile } from "@/lib/floor/types";
import { AppShell } from "@/components/app-shell";
import { WelcomeWizard } from "@/components/welcome-wizard";
import { Skeleton } from "@/components/ui/skeleton";

export function FloorGate({ children }: { children: (me: Profile) => ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    bootstrapFloor()
      .then(async (profile) => {
        if (cancelled) return;
        setMe(profile);
        if (profile.role === "admin" || isFloorAdminEmail(profile.email)) return;
        try {
          const desk = await getDesk();
          if (!cancelled && !desk.profile.onboardedAt) setWelcome(true);
        } catch {
          // Desk packet is optional to open the floor — don't leave them on a blank load.
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not open the floor";
        // Stay signed in — a missing database is not a bad password.
        if (message === "Unauthorized" && !user) setError("auth");
        else setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (isPending) return <ShellSkeleton />;
  if (!user || error === "auth") return <RedirectToSignIn />;
  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-fg">
        <p className="max-w-sm text-sm text-muted">{error}</p>
      </div>
    );
  }
  if (!me) return <ShellSkeleton />;
  if (!me.active) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4 text-center text-fg">
        <div className="max-w-sm space-y-2">
          <p className="text-lg font-semibold">Floor access paused</p>
          <p className="text-sm text-muted">
            An admin took you off the board. Ask them to restore your seat.
          </p>
        </div>
      </div>
    );
  }
  if (welcome) {
    return <WelcomeWizard me={me} onDone={() => setWelcome(false)} />;
  }

  return <AppShell me={me}>{children(me)}</AppShell>;
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-bg px-4 pt-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
