import type { LayoutEdge } from "../../types/layout";
import { COLORS } from "../../lib/constants";

interface RelationshipEdgeProps {
  edge: LayoutEdge;
}

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";

  const [start, ...rest] = points;
  let d = `M ${start.x} ${start.y}`;

  if (rest.length === 1) {
    d += ` L ${rest[0].x} ${rest[0].y}`;
  } else if (rest.length === 3) {
    const [cp1, cp2, end] = rest;
    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
  } else {
    for (const pt of rest) {
      d += ` L ${pt.x} ${pt.y}`;
    }
  }

  return d;
}

function renderOneMarker(
  x: number,
  y: number,
  direction: "left" | "right"
): JSX.Element {
  const dx = direction === "right" ? -8 : 8;
  return (
    <line
      x1={x + dx}
      y1={y - 6}
      x2={x + dx}
      y2={y + 6}
      stroke={COLORS.edgeLine}
      strokeWidth={2}
    />
  );
}

function renderManyMarker(
  x: number,
  y: number,
  direction: "left" | "right"
): JSX.Element {
  const dx = direction === "right" ? -10 : 10;
  const tipDx = direction === "right" ? 0 : 0;
  return (
    <g>
      <line x1={x + tipDx} y1={y} x2={x + dx} y2={y - 7} stroke={COLORS.edgeLine} strokeWidth={1.5} />
      <line x1={x + tipDx} y1={y} x2={x + dx} y2={y + 7} stroke={COLORS.edgeLine} strokeWidth={1.5} />
      <line x1={x + tipDx} y1={y} x2={x + dx} y2={y} stroke={COLORS.edgeLine} strokeWidth={1.5} />
    </g>
  );
}

export function RelationshipEdge({ edge }: RelationshipEdgeProps) {
  const pathD = buildPath(edge.points);
  const start = edge.points[0];
  const end = edge.points[edge.points.length - 1];

  let fromMarker: JSX.Element | null = null;
  let toMarker: JSX.Element | null = null;

  switch (edge.relation) {
    case "one_to_one":
      fromMarker = renderOneMarker(start.x, start.y, "right");
      toMarker = renderOneMarker(end.x, end.y, "left");
      break;
    case "one_to_many":
      fromMarker = renderOneMarker(start.x, start.y, "right");
      toMarker = renderManyMarker(end.x, end.y, "left");
      break;
    case "many_to_one":
      fromMarker = renderManyMarker(start.x, start.y, "right");
      toMarker = renderOneMarker(end.x, end.y, "left");
      break;
    case "many_to_many":
      fromMarker = renderManyMarker(start.x, start.y, "right");
      toMarker = renderManyMarker(end.x, end.y, "left");
      break;
  }

  return (
    <g className="relationship-edge">
      <path
        d={pathD}
        fill="none"
        stroke={COLORS.edgeLine}
        strokeWidth={1.5}
      />
      {fromMarker}
      {toMarker}
    </g>
  );
}
