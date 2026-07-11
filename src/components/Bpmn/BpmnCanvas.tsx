import { useMemo, useState, useCallback } from "react";
import type { LayoutResult, LayoutNode } from "../../types/layout";
import type { BpmnCanvasLayout, BpmnPlacedEdge } from "../../lib/bpmn/canvasLayout";
import { useViewTransform } from "../../hooks/useViewTransform";
import { useTheme } from "../../context/ThemeContext";
import { ZoomControls } from "../Diagram/ZoomControls";
import { MiniMap } from "../Diagram/MiniMap";
import { BpmnEdgeGlyph, NodeGlyph } from "./BpmnGlyphs";

interface BpmnCanvasProps {
  layout: BpmnCanvasLayout;
  storageKey: string;
}

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

  const onEnter = useCallback((id: string) => setHovered(id), []);
  const onLeave = useCallback(() => setHovered(null), []);
  const onSelect = useCallback((id: string) => setSelected(id), []);

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
        <g ref={vt.contentRef}>
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

          {layout.edges.map((e) => (
            <BpmnEdgeGlyph
              key={e.id}
              e={e}
              active={edgeActive(e)}
              highlighted={!!focus && edgeActive(e)}
            />
          ))}

          {layout.nodes.map((n) => (
            <NodeGlyph
              key={n.id}
              n={n}
              selected={selected === n.id}
              dimmed={!!focus && !nodeActive(n.id)}
              onEnter={onEnter}
              onLeave={onLeave}
              onSelect={onSelect}
            />
          ))}
        </g>
      </svg>
      <ZoomControls
        store={vt.store}
        onZoomIn={vt.zoomIn}
        onZoomOut={vt.zoomOut}
        onFitToScreen={vt.fitToScreen}
      />
      <MiniMap
        nodes={miniNodes}
        diagramWidth={layout.width}
        diagramHeight={layout.height}
        store={vt.store}
        setTransform={vt.setTransform}
        commitTransform={vt.commitTransform}
        svgRef={vt.svgRef}
      />
    </div>
  );
}
