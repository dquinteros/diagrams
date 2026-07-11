// Persistence of per-file diagram layout (manual node positions + camera).
// Mirrors the localStorage try/catch pattern used in ThemeContext.

import type { ViewTransform } from "../hooks/useViewTransform";

const POSITIONS_PREFIX = "diagrams-positions-";
const VIEW_PREFIX = "diagrams-view-";

type Override = { x: number; y: number };

export function loadPositions(key: string): Map<string, Override> | null {
  try {
    const raw = localStorage.getItem(POSITIONS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return null;
    // Drop schema-drifted/legacy entries so a missing or non-numeric coordinate
    // can't propagate to NaN positions that render nodes off-screen.
    const entries = parsed.filter(
      (e): e is [string, Override] =>
        Array.isArray(e) &&
        typeof e[0] === "string" &&
        !!e[1] &&
        typeof e[1] === "object" &&
        Number.isFinite((e[1] as Override).x) &&
        Number.isFinite((e[1] as Override).y)
    );
    return new Map(entries);
  } catch {
    return null;
  }
}

export function savePositions(key: string, overrides: Map<string, Override>): void {
  try {
    localStorage.setItem(
      POSITIONS_PREFIX + key,
      JSON.stringify(Array.from(overrides.entries()))
    );
  } catch {
    // localStorage may be unavailable
  }
}

export function loadTransform(key: string): ViewTransform | null {
  try {
    const raw = localStorage.getItem(VIEW_PREFIX + key);
    if (!raw) return null;
    const t = JSON.parse(raw) as ViewTransform;
    // scale must be finite and strictly positive: a persisted 0/NaN renders a
    // blank canvas and makes every zoom divide by it, corrupting the camera.
    if (
      Number.isFinite(t.x) &&
      Number.isFinite(t.y) &&
      Number.isFinite(t.scale) &&
      t.scale > 0
    ) {
      return t;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTransform(key: string, transform: ViewTransform): void {
  try {
    localStorage.setItem(VIEW_PREFIX + key, JSON.stringify(transform));
  } catch {
    // localStorage may be unavailable
  }
}
