import { memo, useMemo } from "react";
import type { BpmnPlacedNode, BpmnPlacedEdge } from "../../lib/bpmn/canvasLayout";
import { useTheme } from "../../context/ThemeContext";
import { TABLE_BORDER_RADIUS } from "../../lib/constants";
import { roundedPath, arrowHead } from "../../lib/edgePath";

const DIM = 0.18;

export const BpmnEdgeGlyph = memo(function BpmnEdgeGlyph({
  e,
  active,
  highlighted,
}: {
  e: BpmnPlacedEdge;
  active: boolean;
  highlighted: boolean;
}) {
  const { theme } = useTheme();
  const color = highlighted ? theme.edgeLineHover : theme.edgeLine;
  const end = e.points[e.points.length - 1];
  const prev = e.points[e.points.length - 2];
  const pathD = useMemo(() => roundedPath(e.points), [e.points]);
  const headD = useMemo(() => arrowHead(end, prev), [end, prev]);
  return (
    <g
      className={highlighted ? "edge-animated" : undefined}
      style={{ opacity: active ? 1 : DIM, transition: "opacity 0.15s" }}
    >
      <path d={pathD} fill="none" stroke={color} strokeWidth={highlighted ? 2.5 : 1.5} />
      <path d={headD} fill={color} />
      {e.label && (
        <text
          x={e.points[0].x + (end.x >= e.points[0].x ? 8 : -8)}
          y={e.points[0].y - 6}
          fill={theme.columnText}
          fontSize={11}
          fontFamily="monospace"
          textAnchor={end.x >= e.points[0].x ? "start" : "end"}
        >
          {e.label}
        </text>
      )}
    </g>
  );
});

export const NodeGlyph = memo(function NodeGlyph({
  n,
  selected,
  dimmed,
  onEnter,
  onLeave,
  onSelect,
}: {
  n: BpmnPlacedNode;
  selected: boolean;
  dimmed: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const stroke = selected ? theme.tableBorderSelected : theme.tableBorder;
  const sw = selected ? 2 : 1;
  const fill = theme.tableHeader;
  const isEvent = n.kind === "start" || n.kind === "end" || n.kind === "event";
  const isGateway = n.kind === "xor" || n.kind === "and";

  let shape: React.ReactNode;
  if (isEvent) {
    const r = n.w / 2;
    shape = (
      <>
        <circle cx={n.cx} cy={n.cy} r={r} fill={fill} stroke={stroke} strokeWidth={n.kind === "end" ? 3 : sw} />
        {n.kind === "event" && <circle cx={n.cx} cy={n.cy} r={r - 4} fill="none" stroke={stroke} strokeWidth={1} />}
      </>
    );
  } else if (isGateway) {
    const r = n.w / 2;
    const pts = `${n.cx},${n.cy - r} ${n.cx + r},${n.cy} ${n.cx},${n.cy + r} ${n.cx - r},${n.cy}`;
    shape = (
      <>
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
        {n.kind === "xor" ? (
          <g stroke={theme.headerText} strokeWidth={2}>
            <line x1={n.cx - 7} y1={n.cy - 7} x2={n.cx + 7} y2={n.cy + 7} />
            <line x1={n.cx - 7} y1={n.cy + 7} x2={n.cx + 7} y2={n.cy - 7} />
          </g>
        ) : (
          <g stroke={theme.headerText} strokeWidth={2}>
            <line x1={n.cx} y1={n.cy - 9} x2={n.cx} y2={n.cy + 9} />
            <line x1={n.cx - 9} y1={n.cy} x2={n.cx + 9} y2={n.cy} />
          </g>
        )}
      </>
    );
  } else {
    shape = (
      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={TABLE_BORDER_RADIUS} ry={TABLE_BORDER_RADIUS} fill={fill} stroke={stroke} strokeWidth={sw} />
    );
  }

  // Event/gateway labels sit below; task labels are centered inside.
  const labelInside = !isEvent && !isGateway;
  return (
    <g
      style={{ cursor: "pointer", opacity: dimmed ? DIM : 1, transition: "opacity 0.15s" }}
      onMouseEnter={() => onEnter(n.id)}
      onMouseLeave={onLeave}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(n.id);
      }}
    >
      {shape}
      <text
        x={n.cx}
        y={labelInside ? n.cy : n.y + n.h + 14}
        textAnchor="middle"
        dominantBaseline={labelInside ? "central" : "auto"}
        fill={labelInside ? theme.headerText : theme.columnText}
        fontSize={12}
        fontWeight={labelInside ? "bold" : "normal"}
        fontFamily="monospace"
      >
        {n.label}
      </text>
    </g>
  );
});
