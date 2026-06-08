import { useRef, useState, useCallback, useEffect } from "react";
import type { SchemaIR } from "../../types/schema";
import type { LayoutResult } from "../../types/layout";
import { TableNode } from "./TableNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { EnumNode } from "./EnumNode";
import { COLORS } from "../../lib/constants";

interface DiagramCanvasProps {
  schema: SchemaIR;
  layout: LayoutResult;
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export function DiagramCanvas({ schema, layout }: DiagramCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ViewTransform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => {
      const newScale = Math.max(0.1, Math.min(3.0, prev.scale * delta));
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, scale: newScale };

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      return {
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
        scale: newScale,
      };
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === svgRef.current || (e.target as Element).classList.contains("canvas-bg")) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        setSelectedTable(null);
      }
    },
    [transform.x, transform.y]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (layout.nodes.size === 0) return;
    setTransform({ x: 40, y: 40, scale: 1 });
  }, [layout.nodes.size]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{
        backgroundColor: COLORS.canvasBg,
        cursor: isPanning ? "grabbing" : "grab",
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <rect
        className="canvas-bg"
        width="100%"
        height="100%"
        fill={COLORS.canvasBg}
      />
      <g
        transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
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
  );
}
