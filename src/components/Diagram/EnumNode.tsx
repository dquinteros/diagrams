import { memo } from "react";
import type { EnumIR } from "../../types/schema";
import type { LayoutNode, DetailLevel } from "../../types/layout";
import {
  TABLE_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  TABLE_PADDING,
  TABLE_BORDER_RADIUS,
} from "../../lib/constants";
import { useTheme } from "../../context/ThemeContext";

interface EnumNodeProps {
  enumBlock: EnumIR;
  layout: LayoutNode;
  detailLevel: DetailLevel;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  onNavigateToSource?: (spanRange: [number, number]) => void;
}

export const EnumNode = memo(function EnumNode({
  enumBlock,
  layout,
  detailLevel,
  onDragStart,
  onNavigateToSource,
}: EnumNodeProps) {
  const { theme } = useTheme();
  const showValues = detailLevel === "full";
  const valueCount = showValues ? enumBlock.values.length : 0;
  const height = HEADER_HEIGHT + valueCount * ROW_HEIGHT + TABLE_PADDING * 2;

  return (
    <g
      transform={`translate(${layout.x}, ${layout.y})`}
      onMouseDown={(e) => onDragStart(layout.id, e)}
      onDoubleClick={() => onNavigateToSource?.(enumBlock.spanRange)}
      style={{ cursor: "move" }}
    >
      <rect
        width={TABLE_WIDTH}
        height={height}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={theme.enumBg}
        stroke={theme.enumHeader}
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      <rect
        width={TABLE_WIDTH}
        height={HEADER_HEIGHT}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={theme.enumHeader}
      />
      <rect
        x={0}
        y={HEADER_HEIGHT - TABLE_BORDER_RADIUS}
        width={TABLE_WIDTH}
        height={TABLE_BORDER_RADIUS}
        fill={theme.enumHeader}
      />
      <text
        x={12}
        y={HEADER_HEIGHT / 2}
        dominantBaseline="central"
        fill={theme.enumLabel}
        fontSize={10}
        fontFamily="monospace"
      >
        enum
      </text>
      <text
        x={TABLE_WIDTH / 2}
        y={HEADER_HEIGHT / 2}
        dominantBaseline="central"
        textAnchor="middle"
        fill={theme.headerText}
        fontSize={13}
        fontWeight="bold"
        fontFamily="monospace"
      >
        {enumBlock.name}
      </text>
      {showValues &&
        enumBlock.values.map((val, i) => {
          const rowY =
            HEADER_HEIGHT + TABLE_PADDING + i * ROW_HEIGHT + ROW_HEIGHT / 2;
          return (
            <text
              key={val.name}
              x={12}
              y={rowY}
              dominantBaseline="central"
              fill={theme.columnText}
              fontSize={12}
              fontFamily="monospace"
            >
              {val.name}
            </text>
          );
        })}
    </g>
  );
});
