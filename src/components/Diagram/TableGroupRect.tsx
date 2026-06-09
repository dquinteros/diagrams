import type { TableGroupIR } from "../../types/schema";
import type { LayoutNode } from "../../types/layout";
import { useTheme } from "../../context/ThemeContext";

interface TableGroupRectProps {
  group: TableGroupIR;
  nodes: Map<string, LayoutNode>;
}

const GROUP_PADDING = 20;

export function TableGroupRect({ group, nodes }: TableGroupRectProps) {
  const { theme } = useTheme();

  const memberNodes = group.tables
    .map((t) => nodes.get(t))
    .filter((n): n is LayoutNode => n !== undefined);

  if (memberNodes.length === 0) return null;

  const minX = Math.min(...memberNodes.map((n) => n.x)) - GROUP_PADDING;
  const minY = Math.min(...memberNodes.map((n) => n.y)) - GROUP_PADDING - 20;
  const maxX = Math.max(...memberNodes.map((n) => n.x + n.width)) + GROUP_PADDING;
  const maxY = Math.max(...memberNodes.map((n) => n.y + n.height)) + GROUP_PADDING;

  return (
    <g>
      <rect
        x={minX}
        y={minY}
        width={maxX - minX}
        height={maxY - minY}
        rx={8}
        ry={8}
        fill={theme.groupBg}
        stroke={theme.groupBorder}
        strokeWidth={1}
        strokeDasharray="6 3"
      />
      <text
        x={minX + 8}
        y={minY + 14}
        fill={theme.toolbarTextMuted}
        fontSize={11}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {group.name}
      </text>
    </g>
  );
}
