// Shared geometry helpers for orthogonal SVG edges, used by the BPMN and
// Architecture canvases so both render connectors with the same rounded look.

export interface Pt {
  x: number;
  y: number;
}

const DEFAULT_CORNER = 8;

/** Build an SVG path for a polyline, rounding interior corners. */
export function roundedPath(points: Pt[], corner = DEFAULT_CORNER): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
  const lerp = (a: Pt, b: Pt, t: number): Pt => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const c = points[i];
    const next = points[i + 1];
    const inLen = dist(prev, c);
    const outLen = dist(c, next);
    if (inLen < 0.5 || outLen < 0.5) {
      d += ` L ${c.x} ${c.y}`;
      continue;
    }
    const r = Math.min(corner, inLen / 2, outLen / 2);
    const a = lerp(c, prev, r / inLen);
    const b = lerp(c, next, r / outLen);
    d += ` L ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/** The three points of a filled triangular arrowhead at `end`, aimed from `prev`. */
export function arrowHead(end: Pt, prev: Pt, len = 9, spread = 0.5): string {
  const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
  const p1 = { x: end.x - len * Math.cos(ang - spread), y: end.y - len * Math.sin(ang - spread) };
  const p2 = { x: end.x - len * Math.cos(ang + spread), y: end.y - len * Math.sin(ang + spread) };
  return `M ${end.x} ${end.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`;
}
