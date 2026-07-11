import { memo, useMemo } from "react";
import type { ArchPlacedNode, ArchPlacedEdge, ArchGroupBand } from "../../lib/architecture/layout";
import { useTheme } from "../../context/ThemeContext";
import { TABLE_BORDER_RADIUS } from "../../lib/constants";
import { roundedPath, arrowHead } from "../../lib/edgePath";
import { ArchIcon } from "./NodeIcons";

const DIM = 0.18;

export const GroupBand = memo(function GroupBand({ grp }: { grp: ArchGroupBand }) {
  const { theme } = useTheme();
  return (
    <g>
      <rect
        x={grp.x}
        y={grp.y}
        width={grp.w}
        height={grp.h}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={theme.groupBg}
        stroke={theme.groupBorder}
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {grp.name && (
        <text
          x={grp.x + 12}
          y={grp.y + 15}
          fill={theme.toolbarTextMuted}
          fontSize={12}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {grp.name}
        </text>
      )}
    </g>
  );
});

export const ArchEdgeGlyph = memo(function ArchEdgeGlyph({
  e,
  active,
  highlighted,
}: {
  e: ArchPlacedEdge;
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
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={highlighted ? 2.5 : 1.5}
        strokeDasharray={e.async ? "6 4" : undefined}
      />
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

export const NodeCard = memo(function NodeCard({
  n,
  selected,
  dimmed,
  onEnter,
  onLeave,
  onSelect,
}: {
  n: ArchPlacedNode;
  selected: boolean;
  dimmed: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const stroke = selected ? theme.tableBorderSelected : theme.tableBorder;
  const sw = selected ? 2 : 1;
  const iconCy = n.y + 22;
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
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={theme.tableHeader}
        stroke={stroke}
        strokeWidth={sw}
      />
      <ArchIcon kind={n.kind} cx={n.cx} cy={iconCy} size={22} color={theme.headerText} />
      <text
        x={n.cx}
        y={n.y + 48}
        textAnchor="middle"
        dominantBaseline="central"
        fill={theme.headerText}
        fontSize={12}
        fontWeight="bold"
        fontFamily="monospace"
      >
        {n.label}
      </text>
      <text
        x={n.cx}
        y={n.y + 62}
        textAnchor="middle"
        dominantBaseline="central"
        fill={theme.columnType}
        fontSize={9}
        fontFamily="monospace"
      >
        {n.kind}
      </text>
    </g>
  );
});
