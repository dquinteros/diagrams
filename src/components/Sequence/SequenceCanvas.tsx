import { useMemo, useState, useCallback } from "react";
import type { LayoutResult, LayoutNode } from "../../types/layout";
import type { SeqLayout, SeqLayoutMessage } from "../../lib/sequence/layout";
import { SEQ_CONSTANTS } from "../../lib/sequence/layout";
import { useViewTransform } from "../../hooks/useViewTransform";
import { useTheme } from "../../context/ThemeContext";
import { ZoomControls } from "../Diagram/ZoomControls";
import { MiniMap } from "../Diagram/MiniMap";
import {
  LifelineGlyph,
  FragmentGlyph,
  ActivationGlyph,
  SeqNoteGlyph,
  ParticipantGlyph,
  MessageGlyph,
} from "./SequenceGlyphs";

interface SequenceCanvasProps {
  layout: SeqLayout;
  storageKey: string;
}

const { HEADER_TOP, HEADER_W } = SEQ_CONSTANTS;

export function SequenceCanvas({ layout, storageKey }: SequenceCanvasProps) {
  const { theme } = useTheme();
  const vtLayout = useMemo<LayoutResult>(
    () => ({ nodes: new Map(), edges: [], width: layout.width, height: layout.height }),
    [layout.width, layout.height]
  );
  const vt = useViewTransform(vtLayout, storageKey);
  const [hovered, setHovered] = useState<string | null>(null);

  // Hovering a participant highlights it and the messages touching it.
  const related = useMemo(() => {
    if (!hovered) return null;
    const set = new Set<string>([hovered]);
    for (const m of layout.messages) {
      if (m.from === hovered) set.add(m.to);
      if (m.to === hovered) set.add(m.from);
    }
    return set;
  }, [hovered, layout.messages]);

  // Minimap overview nodes: one tall bar per participant + note rects.
  const miniNodes = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const p of layout.participants) {
      map.set(p.id, {
        id: p.id,
        x: p.cx - HEADER_W / 2,
        y: HEADER_TOP,
        width: HEADER_W,
        height: Math.max(10, layout.lifelineBottom - HEADER_TOP),
      });
    }
    layout.notes.forEach((n, i) =>
      map.set(`note_${i}`, { id: `note_${i}`, x: n.x, y: n.y, width: n.w, height: n.h })
    );
    return map;
  }, [layout]);

  const pActive = (id: string) => !related || related.has(id);
  const mActive = (m: SeqLayoutMessage) => !hovered || m.from === hovered || m.to === hovered;

  const onHoverParticipant = useCallback((id: string | null) => setHovered(id), []);

  const cursor = vt.isPanning ? "grabbing" : "grab";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={vt.svgRef}
        data-diagram-svg
        width="100%"
        height="100%"
        style={{ backgroundColor: theme.canvasBg, cursor }}
        onMouseDown={vt.handleMouseDown}
        onMouseMove={vt.handleMouseMove}
        onMouseUp={vt.handleMouseUp}
        onMouseLeave={vt.handleMouseUp}
      >
        <rect className="canvas-bg" width="100%" height="100%" fill={theme.canvasBg} />
        <g ref={vt.contentRef}>
          {/* Lifelines */}
          {layout.participants.map((p) => (
            <LifelineGlyph
              key={`life-${p.id}`}
              cx={p.cx}
              top={layout.lifelineTop}
              bottom={layout.lifelineBottom}
              active={pActive(p.id)}
            />
          ))}

          {/* Fragment frames */}
          {layout.fragments.map((f, i) => (
            <FragmentGlyph key={`frag-${i}`} f={f} />
          ))}

          {/* Activation rectangles */}
          {layout.activations.map((a, i) => (
            <ActivationGlyph key={`act-${i}`} a={a} active={pActive(a.id)} />
          ))}

          {/* Messages */}
          {layout.messages.map((m, i) => (
            <MessageGlyph
              key={`msg-${i}`}
              m={m}
              dashed={m.arrow === "dashed-arrow" || m.arrow === "dashed-open"}
              active={mActive(m)}
              highlighted={!!hovered && mActive(m)}
            />
          ))}

          {/* Notes */}
          {layout.notes.map((n, i) => (
            <SeqNoteGlyph key={`note-${i}`} n={n} />
          ))}

          {/* Participant cards (top + bottom) */}
          {layout.participants.map((p) => (
            <ParticipantGlyph
              key={`hdr-${p.id}`}
              p={p}
              lifelineBottom={layout.lifelineBottom}
              hovered={hovered === p.id}
              active={pActive(p.id)}
              onHover={onHoverParticipant}
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
