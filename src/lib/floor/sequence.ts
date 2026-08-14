import { isIsoDay, todayIso } from "./period";

export type SequenceKey = "hunt" | "booked" | "revive";
export type SequenceAction = "call" | "note";

export type SequenceStepDef = {
  title: string;
  offset: number;
  action: SequenceAction;
};

export type SequenceDef = {
  key: SequenceKey;
  name: string;
  blurb: string;
  steps: SequenceStepDef[];
};

export const SEQUENCES: Record<SequenceKey, SequenceDef> = {
  hunt: {
    key: "hunt",
    name: "Hunt",
    blurb: "New file. Six touches in 14 days. Don’t let it go cold.",
    steps: [
      { title: "First live attempt", offset: 0, action: "call" },
      { title: "Next-day bump", offset: 1, action: "call" },
      { title: "Pain recap", offset: 3, action: "call" },
      { title: "Second live", offset: 7, action: "call" },
      { title: "Proof and ask", offset: 10, action: "call" },
      { title: "Breakup", offset: 14, action: "call" },
    ],
  },
  booked: {
    key: "booked",
    name: "Booked demo",
    blurb: "Confirm, lock, then close or rebook. Three beats.",
    steps: [
      { title: "Confirm the demo", offset: 0, action: "call" },
      { title: "Day-before lock", offset: 1, action: "call" },
      { title: "Showed — close or rebook", offset: 3, action: "call" },
    ],
  },
  revive: {
    key: "revive",
    name: "Revive",
    blurb: "Cold file. New angle, then last shot.",
    steps: [
      { title: "Reopen the file", offset: 0, action: "call" },
      { title: "New angle", offset: 2, action: "call" },
      { title: "Last shot", offset: 7, action: "call" },
    ],
  },
};

export const SEQUENCE_KEYS = Object.keys(SEQUENCES) as SequenceKey[];

export function isSequenceKey(value: string | null | undefined): value is SequenceKey {
  return value === "hunt" || value === "booked" || value === "revive";
}

export function sequenceOf(key: string | null | undefined) {
  return isSequenceKey(key) ? SEQUENCES[key] : null;
}

export function addIsoDays(iso: string, days: number) {
  const day = isIsoDay(iso) ? iso : todayIso();
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function buildSequencePlan(key: SequenceKey, startOn = todayIso()) {
  const def = SEQUENCES[key];
  return def.steps.map((step, index) => ({
    index,
    title: step.title,
    action: step.action,
    dueOn: addIsoDays(startOn, step.offset),
  }));
}
