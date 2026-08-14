import type { Sale } from "./types";
import { isIsoDay, todayIso } from "./period";
import { DEFAULT_MARKER } from "./markers";

export const OWNERSHIP_PRICE = 4995;

export const TIERS = [
  { min: 1, max: 4, rate: 0.1, label: "1–4", name: "Tier 1" },
  { min: 5, max: 8, rate: 0.14, label: "5–8", name: "Tier 2" },
  { min: 9, max: 11, rate: 0.2, label: "9–11", name: "Tier 3" },
  { min: 12, max: 19, rate: 0.24, label: "12–19", name: "Tier 4" },
  { min: 20, max: Infinity, rate: 0.35, label: "20+", name: "Tier 5" },
] as const;

export const MILESTONES = [
  { at: 4, amount: 500, label: "Hit 4" },
  { at: 9, amount: 750, label: "Hit 9" },
  { at: 12, amount: 1000, label: "Hit 12" },
  { at: 20, amount: 2000, label: "Hit 20" },
] as const;

export const FAST_START = 1000;
export const PER_CLOSE_AT_TWENTY = 250;
export const INTEL_ATTACH = 175;
export const PAIN_KILLER = 100;
export const SPEED_CLOSE = 100;
export const CLEAN_STREAK = 500;
export const CHARGEBACK_RATE = 0.5;

export type PayLine = {
  key: string;
  label: string;
  amount: number;
};

export type SalePay = {
  saleId: number;
  customerName: string | null;
  soldOn: string;
  dealValue: number;
  base: number;
  perClose: number;
  intelligence: number;
  painKiller: number;
  speedClose: number;
  gross: number;
  chargeback: number;
  net: number;
  refunded: boolean;
};

export type PayStatement = {
  closes: number;
  rate: number;
  tierName: string;
  tierLabel: string;
  nextAt: number | null;
  nextRate: number | null;
  closesToNext: number | null;
  perCloseExtra: number;
  baseCommission: number;
  fastStart: number;
  fastStartEarned: boolean;
  milestones: Array<{ at: number; label: string; amount: number; hit: boolean }>;
  milestoneTotal: number;
  intelligence: number;
  painKiller: number;
  speedClose: number;
  perCloseTotal: number;
  cleanStreakHits: number;
  cleanStreakPay: number;
  currentStreak: number;
  streakToBonus: number;
  chargebacks: number;
  gross: number;
  net: number;
  lines: PayLine[];
  sales: SalePay[];
};

export type CloseFlags = {
  dealValue?: number;
  intelligence?: boolean;
  painKiller?: boolean;
  speedClose?: boolean;
  soldOn?: string;
  refunded?: boolean;
};

export type CloseQuote = {
  closeNumber: number;
  rate: number;
  rerates: boolean;
  ownBase: number;
  rerateLift: number;
  milestone: number;
  milestoneLabel: string | null;
  fastStart: number;
  perClose: number;
  intelligence: number;
  painKiller: number;
  speedClose: number;
  streak: number;
  chargeback: number;
  total: number;
  nextNet: number;
};

export function qualifiesSpeedClose(firstDemoOn: string | null | undefined, soldOn: string) {
  if (!firstDemoOn) return false;
  const a = Date.parse(`${firstDemoOn}T12:00:00Z`);
  const b = Date.parse(`${soldOn}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b - a >= 0 && b - a <= 48 * 60 * 60 * 1000;
}

export function money(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatPay(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(money(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function tierFor(closes: number) {
  if (closes <= 0) return { ...TIERS[0], preview: true as const };
  const hit = [...TIERS].reverse().find((t) => closes >= t.min) ?? TIERS[0];
  return { ...hit, preview: false as const };
}

export function nextTier(closes: number) {
  const next = TIERS.find((t) => t.min > Math.max(closes, 0));
  if (!next) return null;
  return { ...next, remaining: next.min - closes };
}

function dayOfMonth(iso: string) {
  const parts = iso.split("-");
  return Number(parts[2]);
}

function compareSales(a: Sale, b: Sale) {
  if (a.soldOn !== b.soldOn) return a.soldOn.localeCompare(b.soldOn);
  return a.soldAt.localeCompare(b.soldAt);
}

export function computePay(monthSales: Sale[], lifetimeSales: Sale[] = monthSales): PayStatement {
  const ordered = [...monthSales].sort(compareSales);
  const closes = ordered.length;
  const tier = tierFor(closes);
  const nxt = nextTier(closes);
  const rate = closes > 0 ? tier.rate : 0;
  const perCloseExtra = closes >= 20 ? PER_CLOSE_AT_TWENTY : 0;

  const first = ordered[0];
  const fastStartEarned = Boolean(first && dayOfMonth(first.soldOn) <= 3);
  const fastStart = fastStartEarned ? FAST_START : 0;

  const milestones = MILESTONES.map((m) => ({
    at: m.at,
    label: m.label,
    amount: m.amount,
    hit: closes >= m.at,
  }));
  const milestoneTotal = milestones.filter((m) => m.hit).reduce((s, m) => s + m.amount, 0);

  const life = [...lifetimeSales].sort(compareSales);
  let streak = 0;
  const monthIds = new Set(ordered.map((s) => s.id));
  let monthHits = 0;
  for (const sale of life) {
    if (sale.refunded) {
      streak = 0;
      continue;
    }
    streak += 1;
    if (streak > 0 && streak % 5 === 0 && monthIds.has(sale.id)) monthHits += 1;
  }
  const cleanStreakPay = monthHits * CLEAN_STREAK;

  const sales: SalePay[] = ordered.map((sale) => {
    const base = money(sale.dealValue * rate);
    const perClose = perCloseExtra;
    const intelligence = sale.intelligence ? INTEL_ATTACH : 0;
    const painKiller = sale.painKiller ? PAIN_KILLER : 0;
    const speedClose = sale.speedClose ? SPEED_CLOSE : 0;
    const gross = money(base + perClose + intelligence + painKiller + speedClose);
    const chargeback = sale.refunded ? money(gross * CHARGEBACK_RATE) : 0;
    return {
      saleId: sale.id,
      customerName: sale.customerName,
      soldOn: sale.soldOn,
      dealValue: sale.dealValue,
      base,
      perClose,
      intelligence,
      painKiller,
      speedClose,
      gross,
      chargeback,
      net: money(gross - chargeback),
      refunded: sale.refunded,
    };
  });

  const baseCommission = money(sales.reduce((s, row) => s + row.base, 0));
  const perCloseTotal = money(sales.reduce((s, row) => s + row.perClose, 0));
  const intelligence = money(sales.reduce((s, row) => s + row.intelligence, 0));
  const painKiller = money(sales.reduce((s, row) => s + row.painKiller, 0));
  const speedClose = money(sales.reduce((s, row) => s + row.speedClose, 0));
  const chargebacks = money(sales.reduce((s, row) => s + row.chargeback, 0));
  const saleGross = money(sales.reduce((s, row) => s + row.gross, 0));
  const gross = money(saleGross + fastStart + milestoneTotal + cleanStreakPay);
  const net = money(gross - chargebacks);

  const lines: PayLine[] = [
    { key: "base", label: `Base · ${(rate * 100).toFixed(0)}% × ${closes}`, amount: baseCommission },
    { key: "fast", label: "Fast Start (close 1 by the 3rd)", amount: fastStart },
    { key: "miles", label: "Milestone bonuses", amount: milestoneTotal },
    { key: "extra", label: "Tier 5 per-close ($250)", amount: perCloseTotal },
    { key: "intel", label: "Intelligence attach", amount: intelligence },
    { key: "pain", label: "Pain Killer", amount: painKiller },
    { key: "speed", label: "Speed Close", amount: speedClose },
    { key: "streak", label: "Clean Streak", amount: cleanStreakPay },
    { key: "back", label: "Chargebacks (50%)", amount: -chargebacks },
  ].filter((line) => line.amount !== 0);

  return {
    closes,
    rate,
    tierName: closes > 0 ? tier.name : "No closes",
    tierLabel: closes > 0 ? tier.label : "—",
    nextAt: nxt?.min ?? null,
    nextRate: nxt?.rate ?? null,
    closesToNext: nxt?.remaining ?? null,
    perCloseExtra,
    baseCommission,
    fastStart,
    fastStartEarned,
    milestones,
    milestoneTotal,
    intelligence,
    painKiller,
    speedClose,
    perCloseTotal,
    cleanStreakHits: monthHits,
    cleanStreakPay,
    currentStreak: streak,
    streakToBonus: streak === 0 ? 5 : streak % 5 === 0 ? 5 : 5 - (streak % 5),
    chargebacks,
    gross,
    net,
    lines,
    sales,
  };
}

export function salesFromStatement(pay: PayStatement): Sale[] {
  return pay.sales.map((s) => ({
    id: s.saleId,
    userId: "",
    customerId: null,
    customerName: s.customerName,
    dealValue: s.dealValue,
    notes: null,
    soldOn: s.soldOn,
    soldAt: s.soldOn,
    createdBy: "",
    intelligence: s.intelligence > 0,
    painKiller: s.painKiller > 0,
    speedClose: s.speedClose > 0,
    firstDemoOn: null,
    refunded: s.refunded,
    refundedAt: s.refunded ? s.soldOn : null,
    markerColor: DEFAULT_MARKER,
    strokeJson: null,
  }));
}

function draftSale(id: number, flags: CloseFlags = {}): Sale {
  const soldOn = isIsoDay(flags.soldOn) ? flags.soldOn : todayIso();
  const dealValue = Number(flags.dealValue);
  return {
    id,
    userId: "",
    customerId: null,
    customerName: "Next X",
    dealValue: Number.isFinite(dealValue) && dealValue > 0 ? dealValue : OWNERSHIP_PRICE,
    notes: null,
    soldOn,
    soldAt: `${soldOn}T23:59:59`,
    createdBy: "",
    intelligence: Boolean(flags.intelligence),
    painKiller: Boolean(flags.painKiller),
    speedClose: Boolean(flags.speedClose),
    firstDemoOn: null,
    refunded: Boolean(flags.refunded),
    refundedAt: flags.refunded ? soldOn : null,
    markerColor: DEFAULT_MARKER,
    strokeJson: null,
  };
}

export function quoteNextClose(
  monthSales: Sale[],
  lifetimeSales: Sale[] = monthSales,
  flags: CloseFlags = {},
): CloseQuote {
  const current = computePay(monthSales, lifetimeSales);
  const nextSale = draftSale(-1 * (monthSales.length + 1), flags);
  const nextMonth = [...monthSales, nextSale];
  const nextLife = [...lifetimeSales, nextSale];
  const next = computePay(nextMonth, nextLife);
  const ownBase = money(nextSale.dealValue * next.rate);
  const rerateLift = money(next.baseCommission - current.baseCommission - ownBase);
  const milestone = money(next.milestoneTotal - current.milestoneTotal);
  const hit = next.milestones.find((m) => m.hit && !current.milestones.find((c) => c.at === m.at && c.hit));
  return {
    closeNumber: next.closes,
    rate: next.rate,
    rerates: next.rate > current.rate,
    ownBase,
    rerateLift,
    milestone,
    milestoneLabel: hit?.label ?? null,
    fastStart: money(next.fastStart - current.fastStart),
    perClose: money(next.perCloseTotal - current.perCloseTotal),
    intelligence: nextSale.intelligence ? INTEL_ATTACH : 0,
    painKiller: nextSale.painKiller ? PAIN_KILLER : 0,
    speedClose: nextSale.speedClose ? SPEED_CLOSE : 0,
    streak: money(next.cleanStreakPay - current.cleanStreakPay),
    chargeback: money(next.chargebacks - current.chargebacks),
    total: money(next.net - current.net),
    nextNet: next.net,
  };
}

export function projectCloses(
  monthSales: Sale[],
  lifetimeSales: Sale[],
  extra: number,
  flags: CloseFlags = {},
) {
  const quotes: CloseQuote[] = [];
  let month = [...monthSales];
  let life = [...lifetimeSales];
  const n = Math.max(0, Math.min(40, Math.round(extra)));
  for (let i = 0; i < n; i += 1) {
    const quote = quoteNextClose(month, life, flags);
    quotes.push(quote);
    const added = draftSale(-(month.length + 1), flags);
    month = [...month, added];
    life = [...life, added];
  }
  const start = computePay(monthSales, lifetimeSales);
  const end = computePay(month, life);
  return {
    quotes,
    startNet: start.net,
    endNet: end.net,
    added: money(end.net - start.net),
    endCloses: end.closes,
    endRate: end.rate,
    endTier: end.tierName,
  };
}

export function quoteClose(
  monthSales: Sale[],
  lifetimeSales: Sale[],
  flags: CloseFlags = {},
  replacingId?: number | null,
) {
  const month = replacingId == null ? monthSales : monthSales.filter((s) => s.id !== replacingId);
  const life = replacingId == null ? lifetimeSales : lifetimeSales.filter((s) => s.id !== replacingId);
  return quoteNextClose(month, life, flags);
}

export function formatQuoteLine(quote: CloseQuote) {
  const bits = [
    quote.rerates ? "re-rate" : null,
    quote.fastStart ? "Fast Start" : null,
    quote.milestoneLabel,
    quote.streak ? "Clean Streak" : null,
  ].filter(Boolean);
  return `close #${quote.closeNumber}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
}

export function ladderOwnership(count = 20, dealValue = OWNERSHIP_PRICE) {
  const rows: Array<{ closes: number; rate: number; net: number; incremental: number }> = [];
  let prev = 0;
  for (let n = 1; n <= count; n += 1) {
    const sales = Array.from({ length: n }, (_, i) =>
      draftSale(i + 1, { dealValue, soldOn: `2026-08-${String(Math.min(2 + i, 28)).padStart(2, "0")}` }),
    );
    const pay = computePay(sales, sales);
    rows.push({
      closes: n,
      rate: pay.rate,
      net: pay.net,
      incremental: money(pay.net - prev),
    });
    prev = pay.net;
  }
  return rows;
}
