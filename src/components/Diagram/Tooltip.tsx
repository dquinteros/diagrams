import { useTheme } from "../../context/ThemeContext";

interface TooltipProps {
  x: number;
  y: number;
  content: string;
}

export function Tooltip({ x, y, content }: TooltipProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        position: "fixed",
        left: x + 12,
        top: y - 8,
        backgroundColor: theme.tableBg,
        border: `1px solid ${theme.controlBorder}`,
        borderRadius: 4,
        padding: "6px 10px",
        fontSize: 12,
        fontFamily: "monospace",
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
