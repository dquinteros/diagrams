import { memo } from "react";
import type { ColumnIR } from "../../types/schema";
import { ROW_HEIGHT, TABLE_WIDTH } from "../../lib/constants";
import { useTheme } from "../../context/ThemeContext";

interface ColumnRowProps {
  column: ColumnIR;
  index: number;
  y: number;
  isFk: boolean;
}

export const ColumnRow = memo(function ColumnRow({ column, index, y, isFk }: ColumnRowProps) {
  const { theme } = useTheme();
  const rowY = y + index * ROW_HEIGHT;
  const textY = rowY + ROW_HEIGHT / 2;

  return (
    <g>
      {index > 0 && (
        <line
          x1={0}
          y1={rowY}
          x2={TABLE_WIDTH}
          y2={rowY}
          stroke={theme.tableBorder}
          strokeWidth={0.5}
          opacity={0.3}
        />
      )}
      <text
        x={12}
        y={textY}
        dominantBaseline="central"
        fill={theme.columnText}
        fontSize={12}
        fontFamily="monospace"
      >
        {column.name}
      </text>
      {column.check && (
        <text
          x={12 + column.name.length * 7 + 4}
          y={textY}
          dominantBaseline="central"
          fill={theme.uniqueBadge}
          fontSize={9}
          fontWeight="bold"
        >
          ✓
          <title>{`check: ${column.check}`}</title>
        </text>
      )}
      <text
        x={TABLE_WIDTH - 12}
        y={textY}
        dominantBaseline="central"
        textAnchor="end"
        fill={theme.columnType}
        fontSize={11}
        fontFamily="monospace"
      >
        {column.type}
      </text>
      {column.isPk && (
        <text
          x={TABLE_WIDTH - 12 - measureTypeWidth(column.type) - 8}
          y={textY}
          dominantBaseline="central"
          textAnchor="end"
          fill={theme.pkBadge}
          fontSize={9}
          fontWeight="bold"
        >
          PK
        </text>
      )}
      {isFk && !column.isPk && (
        <text
          x={TABLE_WIDTH - 12 - measureTypeWidth(column.type) - 8}
          y={textY}
          dominantBaseline="central"
          textAnchor="end"
          fill={theme.fkBadge}
          fontSize={9}
          fontWeight="bold"
        >
          FK
        </text>
      )}
    </g>
  );
});

function measureTypeWidth(type: string): number {
  return type.length * 6.5;
}
