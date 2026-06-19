import { useMemo } from "react";
import type { LayoutResult } from "../../types/layout";
import type { SeqLayout, SeqLayoutMessage } from "../../lib/sequence/layout";
import { SEQ_CONSTANTS } from "../../lib/sequence/layout";
import type { ArrowKind } from "../../lib/sequence/types";
import { useViewTransform } from "../../hooks/useViewTransform";
import { useTheme } from "../../context/ThemeContext";
import { ZoomControls } from "../Diagram/ZoomControls";

interface SequenceCanvasProps {
  layout: SeqLayout;
  storageKey: string;
}

const { HEADER_TOP, HEADER_H, HEADER_W, ACT_W } = SEQ_CONSTANTS;

export function SequenceCanvas({ layout, storageKey }: SequenceCanvasProps) {
  const { theme } = useTheme();
  const vtLayout = useMemo<LayoutResult>(
    () => ({ nodes: new Map(), edges: [], width: layout.width, height: layout.height }),
    [layout.width, layout.height]
  );
  const vt = useViewTransform(vtLayout, storageKey);

  const isDashed = (a: ArrowKind) => a === "dashed-arrow" || a === "dashed-open";
  const cursor = vt.isPanning ? "grabbing" : "grab";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={vt.svgRef}
        width="100%"
        height="100%"
        style={{ backgroundColor: theme.canvasBg, cursor }}
        onWheel={vt.handleWheel}
        onMouseDown={vt.handleMouseDown}
        onMouseMove={vt.handleMouseMove}
        onMouseUp={vt.handleMouseUp}
        onMouseLeave={vt.handleMouseUp}
      >
        <rect className="canvas-bg" width="100%" height="100%" fill={theme.canvasBg} />
        <g transform={`translate(${vt.transform.x}, ${vt.transform.y}) scale(${vt.transform.scale})`}>
          {/* Lifelines */}
          {layout.participants.map((p) => (
            <line
              key={`life-${p.id}`}
              x1={p.cx}
              y1={layout.lifelineTop}
              x2={p.cx}
              y2={layout.lifelineBottom}
              stroke={theme.edgeLine}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ))}

          {/* Fragment frames */}
          {layout.fragments.map((f, i) => (
            <g key={`frag-${i}`}>
              <rect
                x={f.x}
                y={f.y}
                width={f.w}
                height={f.h}
                fill="none"
                stroke={theme.tableBorder}
                strokeWidth={1}
                rx={4}
              />
              <path
                d={`M ${f.x} ${f.y + 18} L ${f.x + 52} ${f.y + 18} L ${f.x + 44} ${f.y + 18 + 8} L ${f.x} ${f.y + 18 + 8} Z`}
                fill={theme.tableHeader}
                stroke={theme.tableBorder}
                strokeWidth={1}
              />
              <text x={f.x + 6} y={f.y + 13} fill={theme.headerText} fontSize={10} fontWeight="bold" fontFamily="monospace">
                {f.fragType}
              </text>
              {f.label && (
                <text x={f.x + 58} y={f.y + 14} fill={theme.columnText} fontSize={11} fontFamily="monospace">
                  [{f.label}]
                </text>
              )}
              {f.elses.map((e, j) => (
                <g key={j}>
                  <line x1={f.x} y1={e.y} x2={f.x + f.w} y2={e.y} stroke={theme.tableBorder} strokeDasharray="3 3" />
                  <text x={f.x + 6} y={e.y - 3} fill={theme.columnText} fontSize={11} fontFamily="monospace">
                    [{e.label}]
                  </text>
                </g>
              ))}
            </g>
          ))}

          {/* Activation rectangles */}
          {layout.activations.map((a, i) => (
            <rect
              key={`act-${i}`}
              x={a.x - ACT_W / 2}
              y={a.y1}
              width={ACT_W}
              height={Math.max(8, a.y2 - a.y1)}
              fill={theme.tableHeader}
              stroke={theme.tableBorder}
              strokeWidth={1}
            />
          ))}

          {/* Messages */}
          {layout.messages.map((m, i) => (
            <MessageGlyph key={`msg-${i}`} m={m} dashed={isDashed(m.arrow)} theme={theme} />
          ))}

          {/* Notes */}
          {layout.notes.map((n, i) => (
            <g key={`note-${i}`}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={theme.noteBg} stroke={theme.noteBorder} strokeWidth={1} rx={3} />
              {n.lines.map((line, j) => (
                <text
                  key={j}
                  x={n.x + n.w / 2}
                  y={n.y + 14 + j * 16}
                  textAnchor="middle"
                  fill={theme.noteText}
                  fontSize={11}
                  fontFamily="monospace"
                >
                  {line}
                </text>
              ))}
            </g>
          ))}

          {/* Participant headers (top + bottom) */}
          {layout.participants.map((p) => (
            <g key={`hdr-${p.id}`}>
              {[HEADER_TOP, layout.lifelineBottom].map((hy, k) => (
                <g key={k}>
                  <rect
                    x={p.cx - HEADER_W / 2}
                    y={hy}
                    width={HEADER_W}
                    height={HEADER_H}
                    rx={5}
                    fill={theme.tableHeader}
                    stroke={theme.tableBorder}
                    strokeWidth={1}
                  />
                  <text
                    x={p.cx}
                    y={hy + HEADER_H / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={theme.headerText}
                    fontSize={12}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {p.isActor ? `🧍 ${p.label}` : p.label}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>
      <ZoomControls
        zoomPercentage={vt.zoomPercentage}
        onZoomIn={vt.zoomIn}
        onZoomOut={vt.zoomOut}
        onFitToScreen={vt.fitToScreen}
      />
    </div>
  );
}

function MessageGlyph({
  m,
  dashed,
  theme,
}: {
  m: SeqLayoutMessage;
  dashed: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const color = theme.edgeLine;
  const dash = dashed ? "5 4" : undefined;

  if (m.self) {
    const x = m.x1;
    const loopW = 36;
    const top = m.y;
    const bottom = m.y + 26;
    return (
      <g>
        <path
          d={`M ${x} ${top} L ${x + loopW} ${top} L ${x + loopW} ${bottom} L ${x} ${bottom}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={dash}
        />
        <Arrowhead x={x} y={bottom} dir="left" kind={m.arrow} color={color} />
        {m.text && (
          <text x={x + loopW + 6} y={top + 4} fill={theme.columnText} fontSize={11} fontFamily="monospace">
            {m.text}
          </text>
        )}
      </g>
    );
  }

  const dir = m.x2 >= m.x1 ? "right" : "left";
  const midX = (m.x1 + m.x2) / 2;
  return (
    <g>
      <line x1={m.x1} y1={m.y} x2={m.x2} y2={m.y} stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
      <Arrowhead x={m.x2} y={m.y} dir={dir} kind={m.arrow} color={color} />
      {m.text && (
        <text x={midX} y={m.y - 6} textAnchor="middle" fill={theme.columnText} fontSize={11} fontFamily="monospace">
          {m.text}
        </text>
      )}
    </g>
  );
}

function Arrowhead({
  x,
  y,
  dir,
  kind,
  color,
}: {
  x: number;
  y: number;
  dir: "left" | "right";
  kind: ArrowKind;
  color: string;
}) {
  const s = dir === "right" ? -1 : 1; // points back toward the line
  const dx = 9 * s;
  if (kind === "cross") {
    return (
      <g stroke={color} strokeWidth={1.5}>
        <line x1={x + dx} y1={y - 5} x2={x} y2={y + 5} />
        <line x1={x + dx} y1={y + 5} x2={x} y2={y - 5} />
      </g>
    );
  }
  if (kind === "solid-open" || kind === "dashed-open") {
    return (
      <g stroke={color} strokeWidth={1.5} fill="none">
        <line x1={x} y1={y} x2={x + dx} y2={y - 5} />
        <line x1={x} y1={y} x2={x + dx} y2={y + 5} />
      </g>
    );
  }
  // filled triangle (solid-arrow / dashed-arrow)
  return <path d={`M ${x} ${y} L ${x + dx} ${y - 5} L ${x + dx} ${y + 5} Z`} fill={color} />;
}
