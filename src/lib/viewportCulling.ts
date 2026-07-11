// Pure viewport-culling math for the DBML canvas: with hundreds of tables the
// DOM cost is dominated by offscreen nodes, so only elements intersecting the
// (overscanned) viewport are rendered.

import type { ViewTransform } from "../hooks/useViewTransform";
import type { LayoutNode } from "../types/layout";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Pt {
  x: number;
  y: number;
}

/**
 * The viewport in diagram coordinates, expanded by `overscan` (also diagram
 * units) so throttled visibility recomputes don't reveal blank areas mid-pan.
 */
export function visibleRect(
  t: ViewTransform,
  viewportW: number,
  viewportH: number,
  overscan: number
): Rect {
  return {
    x: -t.x / t.scale - overscan,
    y: -t.y / t.scale - overscan,
    w: viewportW / t.scale + overscan * 2,
    h: viewportH / t.scale + overscan * 2,
  };
}

/** Default overscan: at least 400 diagram units or half a viewport per side. */
export function defaultOverscan(t: ViewTransform, viewportW: number): number {
  return Math.max(400, (viewportW / t.scale) * 0.5);
}

function intersects(x: number, y: number, w: number, h: number, r: Rect): boolean {
  return x <= r.x + r.w && x + w >= r.x && y <= r.y + r.h && y + h >= r.y;
}

/** Ids of the nodes whose box intersects the rect. */
export function cullNodes(nodes: Map<string, LayoutNode>, r: Rect): Set<string> {
  const visible = new Set<string>();
  for (const [id, n] of nodes) {
    if (intersects(n.x, n.y, n.width, n.height, r)) visible.add(id);
  }
  return visible;
}

/** Bounding-box test for an orthogonal polyline. */
export function edgeVisible(points: Pt[], r: Rect): boolean {
  if (points.length === 0) return false;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return intersects(minX, minY, maxX - minX, maxY - minY, r);
}
