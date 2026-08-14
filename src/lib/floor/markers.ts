export const MARKERS = [
  { id: "blue", hex: "#0077c8", name: "Blue" },
  { id: "black", hex: "#1c1d20", name: "Black" },
  { id: "red", hex: "#d62828", name: "Red" },
  { id: "green", hex: "#2d6a4f", name: "Green" },
  { id: "purple", hex: "#5a189a", name: "Purple" },
  { id: "orange", hex: "#e85d04", name: "Orange" },
] as const;

export type MarkerId = (typeof MARKERS)[number]["id"];
export type Point = { x: number; y: number };
export type Stroke = Point[];
export type StrokeSet = {
  color: string;
  strokes: Stroke[];
};

export const DEFAULT_MARKER = MARKERS[0].hex;

export function markerByHex(hex: string | null | undefined) {
  const hit = MARKERS.find((m) => m.hex.toLowerCase() === (hex ?? "").toLowerCase());
  return hit ?? MARKERS[0];
}

export function markerForSeed(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n = (n + seed.charCodeAt(i) * (i + 3)) % MARKERS.length;
  return MARKERS[n].hex;
}

export function emptyStrokes(color: string = DEFAULT_MARKER): StrokeSet {
  return { color, strokes: [] };
}

export function parseStrokes(raw: string | null | undefined, fallbackColor: string = DEFAULT_MARKER): StrokeSet | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as StrokeSet;
    if (!data || !Array.isArray(data.strokes)) return null;
    return {
      color: typeof data.color === "string" ? data.color : fallbackColor,
      strokes: data.strokes.filter((s) => Array.isArray(s) && s.length > 1),
    };
  } catch {
    return null;
  }
}

export function strokeLength(set: StrokeSet) {
  let len = 0;
  for (const stroke of set.strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      const a = stroke[i - 1];
      const b = stroke[i];
      len += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return len;
}

export function hasDrawnX(set: StrokeSet | null) {
  if (!set) return false;
  const points = set.strokes.reduce((n, s) => n + s.length, 0);
  return set.strokes.length >= 1 && points >= 8 && strokeLength(set) >= 0.55;
}

export function serializeStrokes(set: StrokeSet) {
  return JSON.stringify({
    color: set.color,
    strokes: set.strokes.map((s) => s.map((p) => ({ x: round(p.x), y: round(p.y) }))),
  });
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
