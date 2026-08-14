import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, ClipboardList, Contact, Shield, LogOut, Banknote, UserRound } from "lucide-react";
import { SuperCMark } from "@/components/logo";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import type { Profile } from "@/lib/floor/types";
import { haptic } from "@/lib/floor/haptics";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Board", icon: LayoutGrid },
  { to: "/dashboard", label: "My Day", icon: ClipboardList },
  { to: "/crm", label: "CRM", icon: Contact },
  { to: "/pay", label: "Pay", icon: Banknote },
  { to: "/desk", label: "Desk", icon: UserRound },
] as const;

export function AppShell({
  me,
  children,
}: {
  me: Profile;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const items = me.role === "admin"
    ? [...NAV, { to: "/admin", label: "Admin", icon: Shield } as const]
    : NAV;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link to="/" className="min-h-11 shrink-0">
            <SuperCMark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg",
                  )}
                  onClick={() => haptic("tap")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
          <Link to="/desk" className="flex min-h-11 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{me.displayName}</p>
              <p className="text-[11px] tracking-wide text-muted uppercase">
                {me.role === "admin" ? "Admin" : "1099"}
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-sm bg-raised text-xs font-semibold sm:size-9">
              {me.initials}
            </span>
          </Link>
            <button
              type="button"
              onClick={() => void signOut("/login")}
              className="grid size-11 place-items-center rounded-sm text-muted hover:bg-raised hover:text-fg sm:size-9"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pt-6 md:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        <div className={cn("grid", items.length >= 6 ? "grid-cols-6" : items.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
          {items.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium sm:text-[11px]",
                  active ? "text-fg" : "text-muted",
                )}
                onClick={() => haptic("tap")}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <span className="sr-only">{user?.primaryEmail}</span>
    </div>
  );
}
