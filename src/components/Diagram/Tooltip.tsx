import { useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

interface TooltipProps {
  x: number;
  y: number;
  content: string;
}

const OFFSET_X = 12;
const OFFSET_Y = 8;
const MARGIN = 8;

export function Tooltip({ x, y, content }: TooltipProps) {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + OFFSET_X, top: y - OFFSET_Y });

  // Clamp/flip against the viewport so the tooltip stays fully on-screen near
  // the right/bottom edges instead of being clipped.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x + OFFSET_X;
    if (left + width + MARGIN > vw) left = x - width - OFFSET_X;
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));

    let top = y - OFFSET_Y;
    top = Math.max(MARGIN, Math.min(top, vh - height - MARGIN));

    setPos({ left, top });
  }, [x, y, content]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        backgroundColor: theme.tableBg,
        border: `1px solid ${theme.controlBorder}`,
        borderRadius: 4,
        padding: "6px 10px",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        color: theme.toolbarText,
        maxWidth: 300,
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
        zIndex: 1000,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {content}
    </div>
  );
}
