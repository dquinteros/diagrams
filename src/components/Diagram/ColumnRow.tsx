import type { ColumnIR } from "../../types/schema";
import { ROW_HEIGHT, TABLE_WIDTH, COLORS } from "../../lib/constants";

interface ColumnRowProps {
  column: ColumnIR;
  index: number;
  y: number;
  isFk: boolean;
}

export function ColumnRow({ column, index, y, isFk }: ColumnRowProps) {
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
          stroke={COLORS.tableBorder}
          strokeWidth={0.5}
          opacity={0.3}
        />
      )}
      <text
        x={12}
        y={textY}
        dominantBaseline="central"
        fill={COLORS.columnText}
        fontSize={12}
        fontFamily="monospace"
      >
        {column.name}
      </text>
      <text
        x={TABLE_WIDTH - 12}
        y={textY}
        dominantBaseline="central"
        textAnchor="end"
        fill={COLORS.columnType}
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
          fill={COLORS.pkBadge}
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
          fill={COLORS.fkBadge}
          fontSize={9}
          fontWeight="bold"
        >
          FK
        </text>
      )}
    </g>
  );
}

function measureTypeWidth(type: string): number {
  return type.length * 6.5;
}
