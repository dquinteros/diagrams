import type { SchemaIR } from "../../types/schema";
import type { LayoutResult } from "../../types/layout";
import { useViewTransform } from "../../hooks/useViewTransform";
import { useTheme } from "../../context/ThemeContext";
import { TableNode } from "./TableNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { EnumNode } from "./EnumNode";
import { ZoomControls } from "./ZoomControls";
import { useState } from "react";

interface DiagramCanvasProps {
  schema: SchemaIR;
  layout: LayoutResult;
  rankdir: "LR" | "TB";
  onToggleRankdir: () => void;
}

export function DiagramCanvas({
  schema,
  layout,
  rankdir,
  onToggleRankdir,
}: DiagramCanvasProps) {
  const { theme } = useTheme();
  const vt = useViewTransform(layout);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    vt.handleMouseDown(e);
    if (
      e.target === vt.svgRef.current ||
      (e.target as Element).classList.contains("canvas-bg")
    ) {
      setSelectedTable(null);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={vt.svgRef}
        width="100%"
        height="100%"
        style={{
          backgroundColor: theme.canvasBg,
          cursor: vt.isPanning ? "grabbing" : "grab",
        }}
        onWheel={vt.handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={vt.handleMouseMove}
        onMouseUp={vt.handleMouseUp}
        onMouseLeave={vt.handleMouseUp}
      >
        <rect
          className="canvas-bg"
          width="100%"
          height="100%"
          fill={theme.canvasBg}
        />
        <g
          transform={`translate(${vt.transform.x}, ${vt.transform.y}) scale(${vt.transform.scale})`}
        >
          {layout.edges.map((edge, i) => (
            <RelationshipEdge key={`${edge.from}-${edge.to}-${i}`} edge={edge} />
          ))}
          {schema.tables.map((table) => {
            const nodeLayout = layout.nodes.get(table.name);
            if (!nodeLayout) return null;
            return (
              <TableNode
                key={table.name}
                table={table}
                layout={nodeLayout}
                schema={schema}
                isSelected={selectedTable === table.name}
                onSelect={setSelectedTable}
              />
            );
          })}
          {schema.enums.map((enumBlock) => {
            const nodeLayout = layout.nodes.get(`enum_${enumBlock.name}`);
            if (!nodeLayout) return null;
            return (
              <EnumNode
                key={enumBlock.name}
                enumBlock={enumBlock}
                layout={nodeLayout}
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
      />
    </div>
  );
}
