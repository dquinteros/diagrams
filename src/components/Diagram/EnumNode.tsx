import type { EnumIR } from "../../types/schema";
import type { LayoutNode } from "../../types/layout";
import {
  TABLE_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  TABLE_PADDING,
  TABLE_BORDER_RADIUS,
  COLORS,
} from "../../lib/constants";

interface EnumNodeProps {
  enumBlock: EnumIR;
  layout: LayoutNode;
}

export function EnumNode({ enumBlock, layout }: EnumNodeProps) {
  const height =
    HEADER_HEIGHT + enumBlock.values.length * ROW_HEIGHT + TABLE_PADDING * 2;

  return (
    <g transform={`translate(${layout.x}, ${layout.y})`}>
      <rect
        width={TABLE_WIDTH}
        height={height}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={COLORS.enumBg}
        stroke={COLORS.enumHeader}
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      <rect
        width={TABLE_WIDTH}
        height={HEADER_HEIGHT}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={COLORS.enumHeader}
      />
      <rect
        x={0}
        y={HEADER_HEIGHT - TABLE_BORDER_RADIUS}
        width={TABLE_WIDTH}
        height={TABLE_BORDER_RADIUS}
        fill={COLORS.enumHeader}
      />
      <text
        x={12}
        y={HEADER_HEIGHT / 2}
        dominantBaseline="central"
        fill="#a6e3a1"
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
        fill={COLORS.headerText}
        fontSize={13}
        fontWeight="bold"
        fontFamily="monospace"
      >
        {enumBlock.name}
      </text>
      {enumBlock.values.map((val, i) => {
        const rowY =
          HEADER_HEIGHT + TABLE_PADDING + i * ROW_HEIGHT + ROW_HEIGHT / 2;
        return (
          <text
            key={val.name}
            x={12}
            y={rowY}
            dominantBaseline="central"
            fill={COLORS.columnText}
            fontSize={12}
            fontFamily="monospace"
          >
            {val.name}
          </text>
        );
      })}
    </g>
  );
}
