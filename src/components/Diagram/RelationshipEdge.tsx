import type { ReactElement } from "react";
import type { LayoutEdge } from "../../types/layout";
import { useTheme } from "../../context/ThemeContext";

interface RelationshipEdgeProps {
  edge: LayoutEdge;
  isDimmed?: boolean;
  isHighlighted?: boolean;
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
    const tickX = x + 8 * out;
    return (
      <line
        x1={tickX} y1={y - 6}
        x2={tickX} y2={y + 6}
        stroke={strokeColor} strokeWidth={2}
      />
    );
  };

  const renderManyMarker = (x: number, y: number, direction: "left" | "right") => {
    const out = direction === "right" ? 1 : -1;
    const apexX = x + 14 * out;
    return (
      <g>
        <line x1={apexX} y1={y} x2={x} y2={y - 7} stroke={strokeColor} strokeWidth={1.5} />
        <line x1={apexX} y1={y} x2={x} y2={y + 7} stroke={strokeColor} strokeWidth={1.5} />
        <line x1={apexX} y1={y} x2={x} y2={y} stroke={strokeColor} strokeWidth={1.5} />
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
