import type { TableIR, SchemaIR } from "../../types/schema";
import type { LayoutNode, DetailLevel } from "../../types/layout";
import { ColumnRow } from "./ColumnRow";
import {
  TABLE_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  TABLE_PADDING,
  TABLE_BORDER_RADIUS,
} from "../../lib/constants";
import { useTheme } from "../../context/ThemeContext";

interface TableNodeProps {
  table: TableIR;
  layout: LayoutNode;
  schema: SchemaIR;
  isSelected: boolean;
  onSelect: (tableName: string) => void;
  onDragStart: (tableName: string, e: React.MouseEvent) => void;
  detailLevel: DetailLevel;
}

export function TableNode({
  table,
  layout,
  schema,
  isSelected,
  onSelect,
  onDragStart,
  detailLevel,
}: TableNodeProps) {
  const { theme } = useTheme();

  const fkColumns = new Set<string>();
  for (const ref of schema.refs) {
    if (ref.fromTable === table.name) {
      ref.fromColumns.forEach((c) => fkColumns.add(c));
    }
    if (ref.toTable === table.name) {
      ref.toColumns.forEach((c) => fkColumns.add(c));
    }
  }

  const visibleColumns =
    detailLevel === "name-only"
      ? []
      : detailLevel === "keys-only"
        ? table.columns.filter((c) => c.isPk || fkColumns.has(c.name))
        : table.columns;

  const height =
    HEADER_HEIGHT + visibleColumns.length * ROW_HEIGHT + TABLE_PADDING * 2;

  return (
    <g
      transform={`translate(${layout.x}, ${layout.y})`}
      onMouseDown={(e) => onDragStart(table.name, e)}
      style={{ cursor: "pointer" }}
    >
      <rect
        width={TABLE_WIDTH}
        height={height}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={theme.tableBg}
        stroke={isSelected ? theme.tableBorderSelected : theme.tableBorder}
        strokeWidth={isSelected ? 2 : 1}
      />
      <rect
        width={TABLE_WIDTH}
        height={HEADER_HEIGHT}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={theme.tableHeader}
      />
      <rect
        x={0}
        y={HEADER_HEIGHT - TABLE_BORDER_RADIUS}
        width={TABLE_WIDTH}
        height={TABLE_BORDER_RADIUS}
        fill={theme.tableHeader}
      />
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
        {table.schema ? `${table.schema}.${table.name}` : table.name}
      </text>
      {visibleColumns.length > 0 && (
        <g transform={`translate(0, ${HEADER_HEIGHT + TABLE_PADDING})`}>
          {visibleColumns.map((col, i) => (
            <ColumnRow
              key={col.name}
              column={col}
              index={i}
              y={0}
              isFk={fkColumns.has(col.name)}
            />
          ))}
        </g>
      )}
    </g>
  );
}
