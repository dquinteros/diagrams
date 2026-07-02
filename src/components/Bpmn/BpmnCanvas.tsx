import { useMemo, useState, useCallback } from "react";
import type { LayoutResult, LayoutNode } from "../../types/layout";
import type { BpmnCanvasLayout, BpmnPlacedNode, BpmnPlacedEdge } from "../../lib/bpmn/canvasLayout";
import { useViewTransform } from "../../hooks/useViewTransform";
import { useTheme } from "../../context/ThemeContext";
import { ZoomControls } from "../Diagram/ZoomControls";
import { MiniMap } from "../Diagram/MiniMap";
import { TABLE_BORDER_RADIUS } from "../../lib/constants";
import { roundedPath, arrowHead, type Pt } from "../../lib/edgePath";

interface BpmnCanvasProps {
  layout: BpmnCanvasLayout;
  storageKey: string;
}

const DIM = 0.18;

export function BpmnCanvas({ layout, storageKey }: BpmnCanvasProps) {
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
  const edgeActive = (e: BpmnPlacedEdge) => !focus || e.from === focus || e.to === focus;

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
          {/* Lane bands */}
          {layout.lanes.map((l, i) => (
            <g key={`lane-${i}`}>
              <rect x={l.x} y={l.y} width={l.w} height={l.h} fill={theme.groupBg} stroke={theme.tableBorder} strokeWidth={1} />
              {l.name && (
                <text
                  x={l.x + 16}
                  y={l.y + l.h / 2}
                  transform={`rotate(-90 ${l.x + 16} ${l.y + l.h / 2})`}
                  textAnchor="middle"
                  fill={theme.toolbarTextMuted}
                  fontSize={12}
                  fontFamily="monospace"
                >
                  {l.name}
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
                <path d={roundedPath(e.points)} fill="none" stroke={color} strokeWidth={highlighted ? 2.5 : 1.5} />
                <Arrow end={end} prev={prev} color={color} />
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
            <NodeGlyph
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

function Arrow({ end, prev, color }: { end: Pt; prev: Pt; color: string }) {
  return <path d={arrowHead(end, prev)} fill={color} />;
}

function NodeGlyph({
  n,
  theme,
  selected,
  dimmed,
  onEnter,
  onLeave,
  onSelect,
}: {
  n: BpmnPlacedNode;
  theme: ReturnType<typeof useTheme>["theme"];
  selected: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const stroke = selected ? theme.tableBorderSelected : theme.tableBorder;
  const sw = selected ? 2 : 1;
  const fill = theme.tableHeader;
  const isEvent = n.kind === "start" || n.kind === "end" || n.kind === "event";
  const isGateway = n.kind === "xor" || n.kind === "and";

  let shape: React.ReactNode;
  if (isEvent) {
    const r = n.w / 2;
    shape = (
      <>
        <circle cx={n.cx} cy={n.cy} r={r} fill={fill} stroke={stroke} strokeWidth={n.kind === "end" ? 3 : sw} />
        {n.kind === "event" && <circle cx={n.cx} cy={n.cy} r={r - 4} fill="none" stroke={stroke} strokeWidth={1} />}
      </>
    );
  } else if (isGateway) {
    const r = n.w / 2;
    const pts = `${n.cx},${n.cy - r} ${n.cx + r},${n.cy} ${n.cx},${n.cy + r} ${n.cx - r},${n.cy}`;
    shape = (
      <>
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
        {n.kind === "xor" ? (
          <g stroke={theme.headerText} strokeWidth={2}>
            <line x1={n.cx - 7} y1={n.cy - 7} x2={n.cx + 7} y2={n.cy + 7} />
            <line x1={n.cx - 7} y1={n.cy + 7} x2={n.cx + 7} y2={n.cy - 7} />
          </g>
        ) : (
          <g stroke={theme.headerText} strokeWidth={2}>
            <line x1={n.cx} y1={n.cy - 9} x2={n.cx} y2={n.cy + 9} />
            <line x1={n.cx - 9} y1={n.cy} x2={n.cx + 9} y2={n.cy} />
          </g>
        )}
      </>
    );
  } else {
    shape = (
      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={TABLE_BORDER_RADIUS} ry={TABLE_BORDER_RADIUS} fill={fill} stroke={stroke} strokeWidth={sw} />
    );
  }

  // Event/gateway labels sit below; task labels are centered inside.
  const labelInside = !isEvent && !isGateway;
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
      {shape}
      <text
        x={n.cx}
        y={labelInside ? n.cy : n.y + n.h + 14}
        textAnchor="middle"
        dominantBaseline={labelInside ? "central" : "auto"}
        fill={labelInside ? theme.headerText : theme.columnText}
        fontSize={12}
        fontWeight={labelInside ? "bold" : "normal"}
        fontFamily="monospace"
      >
        {n.label}
      </text>
    </g>
  );
}
