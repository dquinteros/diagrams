import { useState, useCallback, useRef } from "react";
import type { SchemaIR } from "../../types/schema";
import type { LayoutResult, DetailLevel } from "../../types/layout";
import { useViewTransform } from "../../hooks/useViewTransform";
import { useNodePositions } from "../../hooks/useNodePositions";
import { useTheme } from "../../context/ThemeContext";
import { TableNode } from "./TableNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { EnumNode } from "./EnumNode";
import { ZoomControls } from "./ZoomControls";
import { Tooltip } from "./Tooltip";

interface HoverInfo {
  tableName: string;
  columnName?: string;
  x: number;
  y: number;
}

interface DiagramCanvasProps {
  schema: SchemaIR;
  layout: LayoutResult;
  rankdir: "LR" | "TB";
  onToggleRankdir: () => void;
  detailLevel: DetailLevel;
  onToggleDetailLevel: () => void;
  highlightedTable: string | null;
  onNavigateToSource?: (spanRange: [number, number]) => void;
}

const DRAG_THRESHOLD = 5;

export function DiagramCanvas({
  schema,
  layout,
  rankdir,
  onToggleRankdir,
  detailLevel,
  onToggleDetailLevel,
  highlightedTable,
  onNavigateToSource,
}: DiagramCanvasProps) {
  const { theme } = useTheme();
  const vt = useViewTransform(layout);
  const np = useNodePositions(layout, schema);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const dragStateRef = useRef<{
    tableName: string;
    startMouseX: number;
    startMouseY: number;
    startNodeX: number;
    startNodeY: number;
    moved: boolean;
  } | null>(null);

  const handleTableDragStart = useCallback(
    (tableName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const node = np.nodes.get(tableName);
      if (!node) return;
      dragStateRef.current = {
        tableName,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNodeX: node.x,
        startNodeY: node.y,
        moved: false,
      };
      np.startDrag(tableName);
    },
    [np]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStateRef.current) {
        vt.handleMouseDown(e);
        if (
          e.target === vt.svgRef.current ||
          (e.target as Element).classList.contains("canvas-bg")
        ) {
          setSelectedTable(null);
        }
      }
    },
    [vt]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const ds = dragStateRef.current;
      if (ds) {
        const dx = (e.clientX - ds.startMouseX) / vt.transform.scale;
        const dy = (e.clientY - ds.startMouseY) / vt.transform.scale;
        if (!ds.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        ds.moved = true;
        np.moveNode(ds.tableName, ds.startNodeX + dx, ds.startNodeY + dy);
      } else {
        vt.handleMouseMove(e);
      }
    },
    [vt, np]
  );

  const handleMouseUp = useCallback(() => {
    const ds = dragStateRef.current;
    if (ds) {
      if (!ds.moved) {
        setSelectedTable(ds.tableName);
      }
      dragStateRef.current = null;
      np.endDrag();
    }
    vt.handleMouseUp();
  }, [vt, np]);

  const activeTable = selectedTable ?? highlightedTable;

  const cursor = np.isDragging ? "move" : vt.isPanning ? "grabbing" : "grab";

  const tooltipContent = getTooltipContent(schema, hoverInfo);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={vt.svgRef}
        width="100%"
        height="100%"
        style={{ backgroundColor: theme.canvasBg, cursor }}
        onWheel={vt.handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <rect className="canvas-bg" width="100%" height="100%" fill={theme.canvasBg} />
        <g transform={`translate(${vt.transform.x}, ${vt.transform.y}) scale(${vt.transform.scale})`}>
          {np.edges.map((edge, i) => (
            <RelationshipEdge key={`${edge.from}-${edge.to}-${i}`} edge={edge} />
          ))}
          {schema.tables.map((table) => {
            const nodeLayout = np.nodes.get(table.name);
            if (!nodeLayout) return null;
            return (
              <TableNode
                key={table.name}
                table={table}
                layout={nodeLayout}
                schema={schema}
                isSelected={activeTable === table.name}
                onSelect={setSelectedTable}
                onDragStart={handleTableDragStart}
                onNavigateToSource={onNavigateToSource}
                onHover={setHoverInfo}
                detailLevel={detailLevel}
              />
            );
          })}
          {schema.enums.map((enumBlock) => {
            const nodeLayout = np.nodes.get(`enum_${enumBlock.name}`);
            if (!nodeLayout) return null;
            return (
              <EnumNode
                key={enumBlock.name}
                enumBlock={enumBlock}
                layout={nodeLayout}
                detailLevel={detailLevel}
              />
            );
          })}
        </g>
      </svg>
      <ZoomControls
        zoomPercentage={vt.zoomPercentage}
        onZoomIn={vt.zoomIn}
        onZoomOut={vt.zoomOut}
        onFitToScreen={vt.fitToScreen}
        rankdir={rankdir}
        onToggleRankdir={onToggleRankdir}
        detailLevel={detailLevel}
        onToggleDetailLevel={onToggleDetailLevel}
        onResetLayout={np.resetPositions}
      />
      {tooltipContent && hoverInfo && (
        <Tooltip x={hoverInfo.x} y={hoverInfo.y} content={tooltipContent} />
      )}
    </div>
  );
}

function getTooltipContent(schema: SchemaIR, hover: HoverInfo | null): string | null {
  if (!hover) return null;
  const table = schema.tables.find((t) => t.name === hover.tableName);
  if (!table) return null;

  if (hover.columnName) {
    const col = table.columns.find((c) => c.name === hover.columnName);
    if (!col) return null;
    const enumDef = schema.enums.find((e) => e.name === col.type);
    if (enumDef) {
      return `enum ${enumDef.name}:\n${enumDef.values.map((v) => `  ${v.name}`).join("\n")}`;
    }
    return col.note ?? null;
  }

  return table.note ?? null;
}
