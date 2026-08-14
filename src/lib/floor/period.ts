import type { CustomerStatus, PeriodKey } from "./types";

export const FLOOR_TZ = "America/Chicago";

function chicagoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FLOOR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(grab("year")),
    month: Number(grab("month")),
    day: Number(grab("day")),
    weekday: grab("weekday"),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayIso(date = new Date()) {
  const p = chicagoParts(date);
  return isoDate(p.year, p.month, p.day);
}

export function isIsoDay(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  const dt = new Date(utc);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function weekdayIndex(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function periodRange(key: PeriodKey, now = new Date()) {
  const today = todayIso(now);
  if (key === "today") {
    return { start: today, end: today, label: formatLong(today) };
  }
  if (key === "week") {
    const dow = weekdayIndex(today);
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const start = addDays(today, mondayOffset);
    const end = addDays(start, 6);
    return { start, end, label: `${formatShort(start)} – ${formatShort(end)}` };
  }
  const p = chicagoParts(now);
  const start = isoDate(p.year, p.month, 1);
  const endDay = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
  const end = isoDate(p.year, p.month, endDay);
  return {
    start,
    end,
    label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${start}T12:00:00Z`)),
  };
}

export function toIsoDay(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function formatShort(iso: string) {
  const day = toIsoDay(iso);
  if (!day) return "—";
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatLong(iso: string) {
  const day = toIsoDay(iso);
  if (!day) return "—";
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  follow_up: "Follow-up",
  booked: "Booked",
  sold: "Sold",
  dead: "Dead",
};

export const PIPELINE: Array<{ key: CustomerStatus; label: string }> = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "follow_up", label: "Follow-up" },
  { key: "booked", label: "Booked" },
  { key: "sold", label: "Sold" },
  { key: "dead", label: "Dead" },
];

export const SOURCE_LABEL: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  referral: "Referral",
  repeat: "Repeat",
  other: "Other",
};

export const OUTCOME_LABEL: Record<string, string> = {
  connected: "Connected",
  voicemail: "Voicemail",
  no_answer: "No answer",
  booked: "Booked",
  sold: "Sold",
  not_interested: "Not interested",
};
