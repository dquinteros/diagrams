import type { NoteIR } from "../../types/schema";
import type { LayoutNode } from "../../types/layout";
import { useTheme } from "../../context/ThemeContext";
import {
  HEADER_HEIGHT,
  NOTE_PADDING,
  NOTE_LINE_HEIGHT,
  TABLE_BORDER_RADIUS,
} from "../../lib/constants";
import { wrapNoteText } from "../../lib/layoutEngine";

interface StickyNoteNodeProps {
  note: NoteIR;
  layout: LayoutNode;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  onNavigateToSource?: (spanRange: [number, number]) => void;
}

export function StickyNoteNode({
  note,
  layout,
  onDragStart,
  onNavigateToSource,
}: StickyNoteNodeProps) {
  const { theme } = useTheme();
  const lines = wrapNoteText(note.content);

  return (
    <g
      transform={`translate(${layout.x}, ${layout.y})`}
      onMouseDown={(e) => onDragStart(layout.id, e)}
      onDoubleClick={() => onNavigateToSource?.(note.spanRange)}
      style={{ cursor: "move" }}
    >
      <rect
        width={layout.width}
        height={layout.height}
        rx={TABLE_BORDER_RADIUS}
        ry={TABLE_BORDER_RADIUS}
        fill={theme.noteBg}
        stroke={theme.noteBorder}
        strokeWidth={1}
      />
      <text
        x={NOTE_PADDING}
        y={HEADER_HEIGHT / 2}
        dominantBaseline="central"
        fill={theme.noteTitle}
        fontSize={12}
        fontWeight="bold"
        fontFamily="monospace"
      >
        {note.name ?? "note"}
      </text>
      <line
        x1={0}
        y1={HEADER_HEIGHT}
        x2={layout.width}
        y2={HEADER_HEIGHT}
        stroke={theme.noteBorder}
        strokeWidth={1}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={NOTE_PADDING}
          y={HEADER_HEIGHT + NOTE_PADDING + i * NOTE_LINE_HEIGHT + NOTE_LINE_HEIGHT / 2}
          dominantBaseline="central"
          fill={theme.noteText}
          fontSize={11}
          fontFamily="monospace"
        >
          {line}
        </text>
      ))}
    </g>
  );
}
