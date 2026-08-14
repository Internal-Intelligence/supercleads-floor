export type HapticKind = "tap" | "tick" | "mark" | "success" | "drop" | "warn" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  tick: 16,
  mark: [14, 32, 36],
  success: [10, 40, 18],
  drop: [12, 24, 24],
  warn: [22, 28, 22],
  error: [36, 48, 36],
};

function allowed() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!("vibrate" in navigator) || typeof navigator.vibrate !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

export function haptic(kind: HapticKind = "tap") {
  if (!allowed()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* haptic optional */
  }
}
