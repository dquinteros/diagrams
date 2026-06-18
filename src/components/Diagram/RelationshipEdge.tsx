import type { ReactElement } from "react";
import type { LayoutEdge } from "../../types/layout";
import { useTheme } from "../../context/ThemeContext";

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

export function RelationshipEdge({ edge }: RelationshipEdgeProps) {
  const { theme } = useTheme();
  const pathD = buildPath(edge.points);
  const start = edge.points[0];
  const end = edge.points[edge.points.length - 1];

  const renderOneMarker = (x: number, y: number, direction: "left" | "right") => {
    const dx = direction === "right" ? -8 : 8;
    return (
      <line
        x1={x + dx} y1={y - 6}
        x2={x + dx} y2={y + 6}
        stroke={theme.edgeLine} strokeWidth={2}
      />
    );
  };

  const renderManyMarker = (x: number, y: number, direction: "left" | "right") => {
    const dx = direction === "right" ? -10 : 10;
    return (
      <g>
        <line x1={x} y1={y} x2={x + dx} y2={y - 7} stroke={theme.edgeLine} strokeWidth={1.5} />
        <line x1={x} y1={y} x2={x + dx} y2={y + 7} stroke={theme.edgeLine} strokeWidth={1.5} />
        <line x1={x} y1={y} x2={x + dx} y2={y} stroke={theme.edgeLine} strokeWidth={1.5} />
      </g>
    );
  };

  let fromMarker: ReactElement | null = null;
  let toMarker: ReactElement | null = null;

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
      <path d={pathD} fill="none" stroke={theme.edgeLine} strokeWidth={1.5} />
      {fromMarker}
      {toMarker}
    </g>
  );
}
