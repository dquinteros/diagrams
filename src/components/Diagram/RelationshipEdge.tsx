import type { ReactElement } from "react";
import type { LayoutEdge } from "../../types/layout";
import { useTheme } from "../../context/ThemeContext";

interface RelationshipEdgeProps {
  edge: LayoutEdge;
  isDimmed?: boolean;
  isHighlighted?: boolean;
}

// Marker geometry (drawn outside the table edge).
const MARKER_GAP = 10; // distance of the "one" tick from the table edge
const ONE_HALF = 8; // half-height of the "one" tick
const MANY_APEX = 16; // distance of the crow's-foot apex from the table edge
const MANY_SPREAD = 9; // half-height of the crow's-foot prongs

// Orthogonal routing.
const CORNER_RADIUS = 8;

type Pt = { x: number; y: number };

/** Orthogonal polyline with rounded corners (dbdiagram-style elbows). */
function buildPath(points: Pt[]): string {
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
    const corner = points[i];
    const next = points[i + 1];
    const inLen = dist(prev, corner);
    const outLen = dist(corner, next);
    // Skip degenerate corners (zero-length segment → straight through).
    if (inLen < 0.5 || outLen < 0.5) {
      d += ` L ${corner.x} ${corner.y}`;
      continue;
    }
    const r = Math.min(CORNER_RADIUS, inLen / 2, outLen / 2);
    const entry = lerp(corner, prev, r / inLen);
    const exit = lerp(corner, next, r / outLen);
    d += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function RelationshipEdge({ edge, isDimmed, isHighlighted }: RelationshipEdgeProps) {
  const { theme } = useTheme();
  const pathD = buildPath(edge.points);
  const strokeColor = isHighlighted ? theme.edgeLineHover : theme.edgeLine;
  const strokeWidth = isHighlighted ? 2.5 : 1.5;
  const start = edge.points[0];
  const end = edge.points[edge.points.length - 1];

  // Markers sit OUTSIDE the table edge (in the `out` direction) so they are not
  // hidden behind the table, which renders on top of edges.
  const renderOneMarker = (x: number, y: number, direction: "left" | "right") => {
    const out = direction === "right" ? 1 : -1;
    const tickX = x + MARKER_GAP * out;
    return (
      <line
        x1={tickX} y1={y - ONE_HALF}
        x2={tickX} y2={y + ONE_HALF}
        stroke={strokeColor} strokeWidth={2.5}
      />
    );
  };

  const renderManyMarker = (x: number, y: number, direction: "left" | "right") => {
    const out = direction === "right" ? 1 : -1;
    const apexX = x + MANY_APEX * out;
    return (
      <g>
        <line x1={apexX} y1={y} x2={x} y2={y - MANY_SPREAD} stroke={strokeColor} strokeWidth={2.5} />
        <line x1={apexX} y1={y} x2={x} y2={y + MANY_SPREAD} stroke={strokeColor} strokeWidth={2.5} />
        <line x1={apexX} y1={y} x2={x} y2={y} stroke={strokeColor} strokeWidth={2.5} />
      </g>
    );
  };

  const fromDir = edge.fromSide ?? "right";
  const toDir = edge.toSide ?? "left";

  let fromMarker: ReactElement | null = null;
  let toMarker: ReactElement | null = null;

  switch (edge.relation) {
    case "one_to_one":
      fromMarker = renderOneMarker(start.x, start.y, fromDir);
      toMarker = renderOneMarker(end.x, end.y, toDir);
      break;
    case "one_to_many":
      fromMarker = renderOneMarker(start.x, start.y, fromDir);
      toMarker = renderManyMarker(end.x, end.y, toDir);
      break;
    case "many_to_one":
      fromMarker = renderManyMarker(start.x, start.y, fromDir);
      toMarker = renderOneMarker(end.x, end.y, toDir);
      break;
    case "many_to_many":
      fromMarker = renderManyMarker(start.x, start.y, fromDir);
      toMarker = renderManyMarker(end.x, end.y, toDir);
      break;
  }

  return (
    <g
      className="relationship-edge"
      style={{ opacity: isDimmed ? 0.15 : 1, transition: "opacity 0.15s" }}
    >
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
      {fromMarker}
      {toMarker}
    </g>
  );
}
