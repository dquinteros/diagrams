import { useState, useCallback } from "react";
import type { LayoutNode } from "../../types/layout";
import type { ViewTransform } from "../../hooks/useViewTransform";
import { useTheme } from "../../context/ThemeContext";

const MM_WIDTH = 180;
const MM_HEIGHT = 120;
const MM_PADDING = 6;

interface MiniMapProps {
  nodes: Map<string, LayoutNode>;
  diagramWidth: number;
  diagramHeight: number;
  transform: ViewTransform;
  setTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function MiniMap({
  nodes,
  diagramWidth,
  diagramHeight,
  transform,
  setTransform,
  svgRef,
}: MiniMapProps) {
  const { theme } = useTheme();
  const [dragging, setDragging] = useState(false);

  const innerW = MM_WIDTH - MM_PADDING * 2;
  const innerH = MM_HEIGHT - MM_PADDING * 2;
  const scale =
    diagramWidth > 0 && diagramHeight > 0
      ? Math.min(innerW / diagramWidth, innerH / diagramHeight)
      : 1;

  // Visible viewport expressed in diagram coordinates.
  const svgRect = svgRef.current?.getBoundingClientRect();
  const viewW = svgRect ? svgRect.width / transform.scale : 0;
  const viewH = svgRect ? svgRect.height / transform.scale : 0;
  const viewX = -transform.x / transform.scale;
  const viewY = -transform.y / transform.scale;

  const recenter = useCallback(
    (clientX: number, clientY: number, target: SVGSVGElement) => {
      const rect = target.getBoundingClientRect();
      const diagX = (clientX - rect.left - MM_PADDING) / scale;
      const diagY = (clientY - rect.top - MM_PADDING) / scale;
      const svg = svgRef.current?.getBoundingClientRect();
      if (!svg) return;
      setTransform((prev) => ({
        ...prev,
        x: svg.width / 2 - diagX * prev.scale,
        y: svg.height / 2 - diagY * prev.scale,
      }));
    },
    [scale, setTransform, svgRef]
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        width: MM_WIDTH,
        height: MM_HEIGHT,
        backgroundColor: theme.toolbarBg,
        border: `1px solid ${theme.controlBorder}`,
        borderRadius: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}
    >
      <svg
        width={MM_WIDTH}
        height={MM_HEIGHT}
        style={{ cursor: "pointer", display: "block" }}
        onMouseDown={(e) => {
          setDragging(true);
          recenter(e.clientX, e.clientY, e.currentTarget);
        }}
        onMouseMove={(e) => {
          if (dragging) recenter(e.clientX, e.clientY, e.currentTarget);
        }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        <g transform={`translate(${MM_PADDING}, ${MM_PADDING})`}>
          {Array.from(nodes.values()).map((node) => (
            <rect
              key={node.id}
              x={node.x * scale}
              y={node.y * scale}
              width={Math.max(1, node.width * scale)}
              height={Math.max(1, node.height * scale)}
              fill={theme.tableHeader}
              stroke={theme.tableBorder}
              strokeWidth={0.5}
              rx={1}
            />
          ))}
          <rect
            x={viewX * scale}
            y={viewY * scale}
            width={viewW * scale}
            height={viewH * scale}
            fill={theme.toolbarAccent}
            fillOpacity={0.15}
            stroke={theme.toolbarAccent}
            strokeWidth={1}
            pointerEvents="none"
          />
        </g>
      </svg>
    </div>
  );
}
