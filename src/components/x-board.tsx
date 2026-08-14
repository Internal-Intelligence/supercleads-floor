import { Plus } from "lucide-react";
import { DrawnX } from "@/components/drawn-x";
import { Button } from "@/components/ui/button";
import type { PersonColumn, Profile, Sale } from "@/lib/floor/types";
import { firstName, formatMoney } from "@/lib/floor/period";
import { formatRate } from "@/lib/floor/conversion";
import { haptic } from "@/lib/floor/haptics";
import { cn } from "@/lib/utils";

export function XBoard({
  me,
  people,
  periodLabel,
  periodKey,
  onPeriod,
  onPost,
  onOpenSale,
  freshId,
}: {
  me: Profile;
  people: PersonColumn[];
  periodLabel: string;
  periodKey: "today" | "week" | "month";
  onPeriod: (key: "today" | "week" | "month") => void;
  onPost: (person: PersonColumn) => void;
  onOpenSale: (person: PersonColumn, sale: Sale) => void;
  freshId?: number | null;
}) {
  const floorTotal = people.reduce((sum, p) => sum + p.periodCount, 0);
  const floorTarget = people.reduce((sum, p) => sum + p.monthlyGoal, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
            SuperC-Leads · Floor board
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">The board</h1>
          <p className="mt-1 text-sm text-muted">{periodLabel} · pick a marker, draw the X</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-sm bg-raised p-1 sm:flex sm:bg-transparent sm:p-0">
          {(["today", "week", "month"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                haptic("tap");
                onPeriod(key);
              }}
              className={cn(
                "h-11 flex-1 rounded-sm px-3 text-sm font-medium capitalize sm:h-10 sm:flex-none",
                periodKey === key ? "bg-primary text-primary-fg" : "text-muted hover:text-fg sm:bg-raised",
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="wb-frame rounded-sm p-1.5 sm:p-2">
        <section className="overflow-hidden bg-wb text-wb-ink">
          <header className="bg-wb-bar px-4 py-3 text-center text-white sm:py-4">
            <p className="text-xl font-semibold tracking-[0.14em] sm:text-3xl">
              SALES ACHIEVEMENTS
            </p>
            <p className="mt-1 text-[11px] tracking-[0.18em] uppercase opacity-90">
              SuperC-Leads · {periodLabel}
            </p>
          </header>

          <div className="flex items-center justify-between gap-3 border-b border-wb-line bg-wb-row px-3 py-2">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-wb-bar uppercase">
              {me.role === "admin" ? "Admin override on" : "Live floor"}
            </p>
            <Button
              size="sm"
              className="bg-wb-bar text-white hover:bg-wb-bar/90"
              onClick={() => {
                const self = people.find((p) => p.userId === me.userId);
                if (self) onPost(self);
              }}
            >
              <Plus className="size-4" />
              Draw an X
            </Button>
          </div>

          {people.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-wb-ink/60">
              The board is clean. Grab a marker.
            </p>
          ) : (
            <>
            <div className="snap-row flex overflow-x-auto overscroll-x-contain">
              {people.map((person, index) => (
                <Column
                  key={person.userId}
                  person={person}
                  rank={index + 1}
                  mine={person.userId === me.userId}
                  canPost={person.userId === me.userId || me.role === "admin"}
                  onPost={() => onPost(person)}
                  onOpenSale={(sale) => onOpenSale(person, sale)}
                  freshId={freshId}
                  last={index === people.length - 1}
                />
              ))}
            </div>
            <p className="border-t border-wb-line px-3 py-2 text-center text-[11px] text-wb-ink/55">
              {me.role === "admin"
                ? "Tap any empty square to draw for that rep · tap an X to edit or pull it"
                : people.length > 1
                  ? "Swipe sideways for every rep · tap + to draw"
                  : "Teammates get a column when they sign in"}
            </p>
            </>
          )}

          <footer className="flex items-center justify-between gap-3 bg-wb-bar px-4 py-2 text-white">
            <p className="text-[11px] font-semibold tracking-[0.16em] uppercase">To date</p>
            <p className="text-sm font-semibold tabular-nums">
              {floorTotal} closed
              <span className="mx-2 opacity-70">·</span>
              {floorTarget} target
              <span className="mx-2 opacity-70">·</span>
              {formatMoney(
                people.reduce((s, p) => s + p.sales.reduce((n, sale) => n + sale.dealValue, 0), 0),
              )}
            </p>
          </footer>
        </section>
      </div>
    </div>
  );
}

function Column({
  person,
  rank,
  mine,
  canPost,
  onPost,
  onOpenSale,
  freshId,
  last,
}: {
  person: PersonColumn;
  rank: number;
  mine: boolean;
  canPost: boolean;
  onPost: () => void;
  onOpenSale: (sale: Sale) => void;
  freshId?: number | null;
  last: boolean;
}) {
  const slots = Math.max(person.monthlyGoal, person.periodCount + 1, 6);
  const cells = Array.from({ length: slots }, (_, i) => person.sales[i] ?? null);

  return (
    <article
      className={cn(
        "snap-card flex w-[11.5rem] shrink-0 flex-col border-wb-line sm:w-44",
        !last && "border-r",
        mine && "bg-wb-row/70",
      )}
    >
      <header className="border-b border-wb-line px-3 py-3 text-center">
        <p className="truncate text-[11px] font-semibold tracking-[0.14em] text-wb-bar uppercase">
          {firstName(person.displayName)}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums leading-none">{person.periodCount}</p>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-semibold tracking-wide text-wb-ink/70 uppercase">
          <span>Total {person.periodCount}</span>
          <span>Target {person.monthlyGoal}</span>
        </div>
        <p className="mt-1 text-[11px] text-wb-ink/55">
          {person.out
            ? person.out.kind === "sick"
              ? "Out sick"
              : "Off the floor"
            : `${formatRate(person.closeRate)} close`}
        </p>
      </header>
      <div className="grid grid-cols-2">
        {cells.map((sale, i) =>
          sale ? (
            <button
              key={sale.id}
              type="button"
              onClick={() => {
                haptic("tick");
                onOpenSale(sale);
              }}
              className={cn(
                "grid aspect-square min-h-14 place-items-center border-wb-line p-1.5",
                i % 2 === 0 ? "border-r" : "",
                "border-b",
              )}
              aria-label={`Sale ${sale.id}`}
            >
              <DrawnX
                strokeJson={sale.strokeJson}
                color={sale.markerColor || person.markerColor}
                fresh={sale.id === freshId}
                className="size-10"
              />
            </button>
          ) : (
            <button
              key={`empty-${i}`}
              type="button"
              disabled={!canPost || i !== person.periodCount}
              onClick={onPost}
              className={cn(
                "grid aspect-square min-h-14 place-items-center border-wb-line",
                i % 2 === 0 ? "border-r" : "",
                "border-b",
                canPost && i === person.periodCount
                  ? "text-wb-bar hover:bg-wb-row"
                  : "opacity-40",
              )}
              aria-label={canPost && i === person.periodCount ? `Draw X for ${person.displayName}` : undefined}
            >
              {canPost && i === person.periodCount ? <Plus className="size-4" /> : null}
            </button>
          ),
        )}
      </div>
    </article>
  );
}
