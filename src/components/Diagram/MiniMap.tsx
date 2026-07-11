import { useState, useCallback, useEffect } from "react";
import type { LayoutNode } from "../../types/layout";
import type {
  TransformStore,
  ViewTransform,
  SetTransformOptions,
} from "../../hooks/useViewTransform";
import { useTheme } from "../../context/ThemeContext";
import { MiniMapViewport } from "./MiniMapViewport";

const MM_WIDTH = 180;
const MM_HEIGHT = 120;
const MM_PADDING = 6;

interface MiniMapProps {
  nodes: Map<string, LayoutNode>;
  diagramWidth: number;
  diagramHeight: number;
  store: TransformStore;
  setTransform: (
    action: React.SetStateAction<ViewTransform>,
    opts?: SetTransformOptions
  ) => void;
  commitTransform: () => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function MiniMap({
  nodes,
  diagramWidth,
  diagramHeight,
  store,
  setTransform,
  commitTransform,
  svgRef,
}: MiniMapProps) {
  const { theme } = useTheme();
  const [dragging, setDragging] = useState(false);
  // Track the canvas SVG size in state (not by reading the ref during render) so
  // the viewport indicator is correct on first paint and updates on resize.
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSvgSize({ width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [svgRef]);

  const innerW = MM_WIDTH - MM_PADDING * 2;
  const innerH = MM_HEIGHT - MM_PADDING * 2;
  const scale =
    diagramWidth > 0 && diagramHeight > 0
      ? Math.min(innerW / diagramWidth, innerH / diagramHeight)
      : 1;

  // While dragging the minimap the camera moves live (no React commit per
  // frame); the position commits once on release.
  const recenter = useCallback(
    (clientX: number, clientY: number, target: SVGSVGElement, commit: boolean) => {
      const rect = target.getBoundingClientRect();
      const diagX = (clientX - rect.left - MM_PADDING) / scale;
      const diagY = (clientY - rect.top - MM_PADDING) / scale;
      const svg = svgRef.current?.getBoundingClientRect();
      if (!svg) return;
      setTransform(
        (prev) => ({
          ...prev,
          x: svg.width / 2 - diagX * prev.scale,
          y: svg.height / 2 - diagY * prev.scale,
        }),
        { commit }
      );
    },
    [scale, setTransform, svgRef]
  );

  const endDrag = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    commitTransform();
  }, [dragging, commitTransform]);

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
          recenter(e.clientX, e.clientY, e.currentTarget, false);
        }}
        onMouseMove={(e) => {
          if (dragging) recenter(e.clientX, e.clientY, e.currentTarget, false);
        }}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
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
          <MiniMapViewport
            store={store}
            svgWidth={svgSize.width}
            svgHeight={svgSize.height}
            scale={scale}
            accent={theme.toolbarAccent}
          />
        </g>
      </svg>
    </div>
  );
}
