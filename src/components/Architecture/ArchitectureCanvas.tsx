import { useMemo, useState, useCallback } from "react";
import type { LayoutResult, LayoutNode } from "../../types/layout";
import type {
  ArchCanvasLayout,
  ArchPlacedNode,
  ArchPlacedEdge,
} from "../../lib/architecture/layout";
import { useViewTransform } from "../../hooks/useViewTransform";
import { useTheme } from "../../context/ThemeContext";
import { ZoomControls } from "../Diagram/ZoomControls";
import { MiniMap } from "../Diagram/MiniMap";
import { TABLE_BORDER_RADIUS } from "../../lib/constants";
import { roundedPath, arrowHead } from "../../lib/edgePath";
import { ArchIcon } from "./NodeIcons";

interface ArchitectureCanvasProps {
  layout: ArchCanvasLayout;
  storageKey: string;
}

const DIM = 0.18;

export function ArchitectureCanvas({ layout, storageKey }: ArchitectureCanvasProps) {
  const { theme } = useTheme();
  const vtLayout = useMemo<LayoutResult>(
    () => ({ nodes: new Map(), edges: [], width: layout.width, height: layout.height }),
    [layout.width, layout.height]
  );
  const vt = useViewTransform(vtLayout, storageKey);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const focus = hovered ?? selected;

  const related = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const e of layout.edges) {
      if (e.from === focus) set.add(e.to);
      if (e.to === focus) set.add(e.from);
    }
    return set;
  }, [focus, layout.edges]);

  const miniNodes = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    for (const n of layout.nodes) m.set(n.id, { id: n.id, x: n.x, y: n.y, width: n.w, height: n.h });
    return m;
  }, [layout.nodes]);

  const nodeActive = (id: string) => !related || related.has(id);
  const edgeActive = (e: ArchPlacedEdge) => !focus || e.from === focus || e.to === focus;

  const onBgDown = useCallback(
    (ev: React.MouseEvent) => {
      vt.handleMouseDown(ev);
      const el = ev.target as Element;
      if (el === vt.svgRef.current || el.classList.contains("canvas-bg")) setSelected(null);
    },
    [vt]
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={vt.svgRef}
        data-diagram-svg
        width="100%"
        height="100%"
        style={{ backgroundColor: theme.canvasBg, cursor: vt.isPanning ? "grabbing" : "grab" }}
        onMouseDown={onBgDown}
        onMouseMove={vt.handleMouseMove}
        onMouseUp={vt.handleMouseUp}
        onMouseLeave={vt.handleMouseUp}
      >
        <rect className="canvas-bg" width="100%" height="100%" fill={theme.canvasBg} />
        <g transform={`translate(${vt.transform.x}, ${vt.transform.y}) scale(${vt.transform.scale})`}>
          {/* Group bands */}
          {layout.groups.map((grp, i) => (
            <g key={`grp-${i}`}>
              <rect
                x={grp.x}
                y={grp.y}
                width={grp.w}
                height={grp.h}
                rx={TABLE_BORDER_RADIUS}
                ry={TABLE_BORDER_RADIUS}
                fill={theme.groupBg}
                stroke={theme.groupBorder}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              {grp.name && (
                <text
                  x={grp.x + 12}
                  y={grp.y + 15}
                  fill={theme.toolbarTextMuted}
                  fontSize={12}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {grp.name}
                </text>
              )}
            </g>
          ))}

          {/* Edges */}
          {layout.edges.map((e) => {
            const active = edgeActive(e);
            const highlighted = !!focus && active;
            const color = highlighted ? theme.edgeLineHover : theme.edgeLine;
            const end = e.points[e.points.length - 1];
            const prev = e.points[e.points.length - 2];
            return (
              <g
                key={e.id}
                className={highlighted ? "edge-animated" : undefined}
                style={{ opacity: focus && !active ? DIM : 1, transition: "opacity 0.15s" }}
              >
                <path
                  d={roundedPath(e.points)}
                  fill="none"
                  stroke={color}
                  strokeWidth={highlighted ? 2.5 : 1.5}
                  strokeDasharray={e.async ? "6 4" : undefined}
                />
                <path d={arrowHead(end, prev)} fill={color} />
                {e.label && (
                  <text
                    x={e.points[0].x + (end.x >= e.points[0].x ? 8 : -8)}
                    y={e.points[0].y - 6}
                    fill={theme.columnText}
                    fontSize={11}
                    fontFamily="monospace"
                    textAnchor={end.x >= e.points[0].x ? "start" : "end"}
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {layout.nodes.map((n) => (
            <NodeCard
              key={n.id}
              n={n}
              theme={theme}
              selected={selected === n.id}
              dimmed={!!focus && !nodeActive(n.id)}
              onEnter={() => setHovered(n.id)}
              onLeave={() => setHovered(null)}
              onSelect={() => setSelected(n.id)}
            />
          ))}
        </g>
      </svg>
      <ZoomControls
        zoomPercentage={vt.zoomPercentage}
        onZoomIn={vt.zoomIn}
        onZoomOut={vt.zoomOut}
        onFitToScreen={vt.fitToScreen}
      />
      <MiniMap
        nodes={miniNodes}
        diagramWidth={layout.width}
        diagramHeight={layout.height}
        transform={vt.transform}
        setTransform={vt.setTransform}
        svgRef={vt.svgRef}
      />
    </div>
  );
}

function NodeCard({
  n,
  theme,
  selected,
  dimmed,
  onEnter,
  onLeave,
  onSelect,
}: {
  n: ArchPlacedNode;
  theme: ReturnType<typeof useTheme>["theme"];
  selected: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const stroke = selected ? theme.tableBorderSelected : theme.tableBorder;
  const sw = selected ? 2 : 1;
  const iconCy = n.y + 22;
  return (
    <g
      style={{ cursor: "pointer", opacity: dimmed ? DIM : 1, transition: "opacity 0.15s" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={theme.tableHeader}
        stroke={stroke}
        strokeWidth={sw}
      />
      <ArchIcon kind={n.kind} cx={n.cx} cy={iconCy} size={22} color={theme.headerText} />
      <text
        x={n.cx}
        y={n.y + 48}
        textAnchor="middle"
        dominantBaseline="central"
        fill={theme.headerText}
        fontSize={12}
        fontWeight="bold"
        fontFamily="monospace"
      >
        {n.label}
      </text>
      <text
        x={n.cx}
        y={n.y + 62}
        textAnchor="middle"
        dominantBaseline="central"
        fill={theme.columnType}
        fontSize={9}
        fontFamily="monospace"
      >
        {n.kind}
      </text>
    </g>
  );
}
