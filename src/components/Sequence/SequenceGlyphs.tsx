import { memo } from "react";
import type { SeqLayout, SeqLayoutMessage } from "../../lib/sequence/layout";
import { SEQ_CONSTANTS } from "../../lib/sequence/layout";
import type { ArrowKind } from "../../lib/sequence/types";
import { useTheme } from "../../context/ThemeContext";
import { TABLE_BORDER_RADIUS } from "../../lib/constants";

const { HEADER_TOP, HEADER_H, HEADER_W, ACT_W } = SEQ_CONSTANTS;
const DIM = 0.2;

const dimStyle = (active: boolean): React.CSSProperties => ({
  opacity: active ? 1 : DIM,
  transition: "opacity 0.15s",
});

export const LifelineGlyph = memo(function LifelineGlyph({
  cx,
  top,
  bottom,
  active,
}: {
  cx: number;
  top: number;
  bottom: number;
  active: boolean;
}) {
  const { theme } = useTheme();
  return (
    <line
      x1={cx}
      y1={top}
      x2={cx}
      y2={bottom}
      stroke={theme.edgeLine}
      strokeWidth={1}
      strokeDasharray="4 4"
      style={dimStyle(active)}
    />
  );
});

export const FragmentGlyph = memo(function FragmentGlyph({
  f,
}: {
  f: SeqLayout["fragments"][number];
}) {
  const { theme } = useTheme();
  return (
    <g>
      <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="none" stroke={theme.tableBorder} strokeWidth={1} rx={TABLE_BORDER_RADIUS} />
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
  );
});

export const ActivationGlyph = memo(function ActivationGlyph({
  a,
  active,
}: {
  a: SeqLayout["activations"][number];
  active: boolean;
}) {
  const { theme } = useTheme();
  return (
    <rect
      x={a.x - ACT_W / 2}
      y={a.y1}
      width={ACT_W}
      height={Math.max(8, a.y2 - a.y1)}
      fill={theme.tableHeader}
      stroke={theme.tableBorder}
      strokeWidth={1}
      style={dimStyle(active)}
    />
  );
});

export const SeqNoteGlyph = memo(function SeqNoteGlyph({
  n,
}: {
  n: SeqLayout["notes"][number];
}) {
  const { theme } = useTheme();
  return (
    <g>
      <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={theme.noteBg} stroke={theme.noteBorder} strokeWidth={1} rx={TABLE_BORDER_RADIUS} />
      {n.lines.map((line, j) => (
        <text key={j} x={n.x + n.w / 2} y={n.y + 14 + j * 16} textAnchor="middle" fill={theme.noteText} fontSize={11} fontFamily="monospace">
          {line}
        </text>
      ))}
    </g>
  );
});

export const ParticipantGlyph = memo(function ParticipantGlyph({
  p,
  lifelineBottom,
  hovered,
  active,
  onHover,
}: {
  p: SeqLayout["participants"][number];
  lifelineBottom: number;
  hovered: boolean;
  active: boolean;
  onHover: (id: string | null) => void;
}) {
  const { theme } = useTheme();
  return (
    <g
      style={{ cursor: "pointer", ...dimStyle(active) }}
      onMouseEnter={() => onHover(p.id)}
      onMouseLeave={() => onHover(null)}
    >
      {[HEADER_TOP, lifelineBottom].map((hy, k) => (
        <g key={k}>
          <rect
            x={p.cx - HEADER_W / 2}
            y={hy}
            width={HEADER_W}
            height={HEADER_H}
            rx={TABLE_BORDER_RADIUS}
            ry={TABLE_BORDER_RADIUS}
            fill={theme.tableHeader}
            stroke={hovered ? theme.tableBorderSelected : theme.tableBorder}
            strokeWidth={hovered ? 2 : 1}
          />
          <text
            x={p.cx}
            y={hy + HEADER_H / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={theme.headerText}
            fontSize={13}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {p.isActor ? `🧍 ${p.label}` : p.label}
          </text>
        </g>
      ))}
    </g>
  );
});

export const MessageGlyph = memo(function MessageGlyph({
  m,
  dashed,
  active,
  highlighted,
}: {
  m: SeqLayoutMessage;
  dashed: boolean;
  active: boolean;
  highlighted: boolean;
}) {
  const { theme } = useTheme();
  const color = highlighted ? theme.edgeLineHover : theme.edgeLine;
  const width = highlighted ? 2.5 : 1.5;
  const dash = dashed ? "5 4" : undefined;
  const style = dimStyle(active);

  if (m.self) {
    const x = m.x1;
    const loopW = 36;
    const top = m.y;
    const bottom = m.y + 26;
    return (
      <g style={style}>
        <path d={`M ${x} ${top} L ${x + loopW} ${top} L ${x + loopW} ${bottom} L ${x} ${bottom}`} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} />
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
    <g style={style}>
      <line x1={m.x1} y1={m.y} x2={m.x2} y2={m.y} stroke={color} strokeWidth={width} strokeDasharray={dash} />
      <Arrowhead x={m.x2} y={m.y} dir={dir} kind={m.arrow} color={color} />
      {m.text && (
        <text x={midX} y={m.y - 6} textAnchor="middle" fill={theme.columnText} fontSize={11} fontFamily="monospace">
          {m.text}
        </text>
      )}
    </g>
  );
});

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
  const s = dir === "right" ? -1 : 1;
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
  return <path d={`M ${x} ${y} L ${x + dx} ${y - 5} L ${x + dx} ${y + 5} Z`} fill={color} />;
}
