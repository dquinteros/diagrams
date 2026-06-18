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
    const entries = JSON.parse(raw) as [string, Override][];
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
    if (
      typeof t.x === "number" &&
      typeof t.y === "number" &&
      typeof t.scale === "number"
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
