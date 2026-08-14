export type ConversionRate = {
  key: string;
  label: string;
  hint: string;
  won: number;
  base: number;
  pct: number;
};

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
};

export type RepConversion = {
  userId: string;
  name: string;
  files: number;
  worked: number;
  sold: number;
  dead: number;
  booked: number;
  calls: number;
  connects: number;
  sales: number;
  closeRate: number;
  leadRate: number;
  bookRate: number;
  connectRate: number;
  callCloseRate: number;
  funnel: FunnelStage[];
  rates: ConversionRate[];
};

export function pct(won: number, base: number) {
  if (base <= 0) return 0;
  return Math.round((won / base) * 1000) / 10;
}

export function formatRate(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

function makeRate(key: string, label: string, hint: string, won: number, base: number): ConversionRate {
  return { key, label, hint, won, base, pct: pct(won, base) };
}

const CONNECTED = new Set(["connected", "booked", "sold"]);

export function buildRepConversion(input: {
  userId: string;
  name: string;
  statuses: Record<string, number>;
  calls: Array<{ outcome: string }>;
  sales: number;
}): RepConversion {
  const files = Object.values(input.statuses).reduce((s, n) => s + n, 0);
  const sold = input.statuses.sold ?? 0;
  const dead = input.statuses.dead ?? 0;
  const booked = input.statuses.booked ?? 0;
  const newFiles = input.statuses.new ?? 0;
  const worked = files - newFiles;
  const closed = sold + dead;
  const pitched = sold + booked + dead;
  const connects = input.calls.filter((c) => CONNECTED.has(c.outcome)).length;
  const closeRate = pct(sold, closed);
  const leadRate = pct(sold, Math.max(worked, files));
  const bookRate = pct(sold, pitched);
  const connectRate = pct(connects, input.calls.length);
  const callCloseRate = pct(input.sales, input.calls.length);
  const funnel: FunnelStage[] = [
    { key: "new", label: "New", count: newFiles },
    { key: "contacted", label: "Contacted", count: input.statuses.contacted ?? 0 },
    { key: "follow_up", label: "Follow-up", count: input.statuses.follow_up ?? 0 },
    { key: "booked", label: "Booked", count: booked },
    { key: "sold", label: "Sold", count: sold },
    { key: "dead", label: "Dead", count: dead },
  ];
  return {
    userId: input.userId,
    name: input.name,
    files,
    worked,
    sold,
    dead,
    booked,
    calls: input.calls.length,
    connects,
    sales: input.sales,
    closeRate,
    leadRate,
    bookRate,
    connectRate,
    callCloseRate,
    funnel,
    rates: [
      makeRate("close", "Close", "Sold / closed files", sold, closed),
      makeRate("lead", "Lead → X", "Sold / files worked", sold, Math.max(worked, files)),
      makeRate("book", "Demo → X", "Sold / booked + closed", sold, pitched),
      makeRate("connect", "Connect", "Live calls / all calls", connects, input.calls.length),
      makeRate("dial", "Dial → X", "Closes / calls", input.sales, input.calls.length),
    ],
  };
}

export function mergeConversions(name: string, rows: RepConversion[]): RepConversion {
  const statuses: Record<string, number> = {};
  for (const row of rows) {
    for (const stage of row.funnel) {
      statuses[stage.key] = (statuses[stage.key] ?? 0) + stage.count;
    }
  }
  const calls = rows.flatMap((row) =>
    Array.from({ length: row.calls }, (_, i) => ({
      outcome: i < row.connects ? "connected" : "no_answer",
    })),
  );
  return buildRepConversion({
    userId: "floor",
    name,
    statuses,
    calls,
    sales: rows.reduce((s, r) => s + r.sales, 0),
  });
}
