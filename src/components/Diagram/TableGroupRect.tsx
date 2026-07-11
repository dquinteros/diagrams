import { memo, useMemo } from "react";
import type { TableGroupIR } from "../../types/schema";
import type { LayoutNode } from "../../types/layout";
import { useTheme } from "../../context/ThemeContext";

interface TableGroupRectProps {
  group: TableGroupIR;
  nodes: Map<string, LayoutNode>;
}

const GROUP_PADDING = 20;

// Memoized: `nodes` only changes identity when a node is dragged, so the
// bounding box is not recomputed during hover/selection re-renders.
export const TableGroupRect = memo(function TableGroupRect({
  group,
  nodes,
}: TableGroupRectProps) {
  const { theme } = useTheme();

  const box = useMemo(() => {
    const memberNodes = group.tables
      .map((t) => nodes.get(t))
      .filter((n): n is LayoutNode => n !== undefined);
    if (memberNodes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of memberNodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
    return {
      minX: minX - GROUP_PADDING,
      minY: minY - GROUP_PADDING - 20,
      maxX: maxX + GROUP_PADDING,
      maxY: maxY + GROUP_PADDING,
    };
  }, [group.tables, nodes]);

  if (!box) return null;

  return (
    <g>
      <rect
        x={box.minX}
        y={box.minY}
        width={box.maxX - box.minX}
        height={box.maxY - box.minY}
        rx={8}
        ry={8}
        fill={theme.groupBg}
        stroke={theme.groupBorder}
        strokeWidth={1}
        strokeDasharray="6 3"
      />
      <text
        x={box.minX + 8}
        y={box.minY + 14}
        fill={theme.toolbarTextMuted}
        fontSize={11}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {group.name}
      </text>
    </g>
  );
});
