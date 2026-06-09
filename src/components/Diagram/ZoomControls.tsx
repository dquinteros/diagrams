import { useTheme } from "../../context/ThemeContext";

interface ZoomControlsProps {
  zoomPercentage: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  rankdir: "LR" | "TB";
  onToggleRankdir: () => void;
}

export function ZoomControls({
  zoomPercentage,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  rankdir,
  onToggleRankdir,
}: ZoomControlsProps) {
  const { theme } = useTheme();

  const btnStyle: React.CSSProperties = {
    background: theme.controlBg,
    border: `1px solid ${theme.controlBorder}`,
    color: theme.controlText,
    width: 28,
    height: 28,
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "monospace",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        display: "flex",
        gap: 4,
        alignItems: "center",
        backgroundColor: theme.toolbarBg,
        border: `1px solid ${theme.toolbarBorder}`,
        borderRadius: 6,
        padding: "4px 6px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <button
        onClick={onFitToScreen}
        style={btnStyle}
        title="Fit to screen"
        onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
        onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlBg)}
      >
        {"[ ]"}
      </button>
      <button
        onClick={onZoomOut}
        style={btnStyle}
        title="Zoom out"
        onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
        onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlBg)}
      >
        -
      </button>
      <span
        style={{
          color: theme.toolbarTextMuted,
          fontSize: 11,
          fontFamily: "monospace",
          minWidth: 38,
          textAlign: "center",
          userSelect: "none",
        }}
      >
        {zoomPercentage}%
      </span>
      <button
        onClick={onZoomIn}
        style={btnStyle}
        title="Zoom in"
        onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
        onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlBg)}
      >
        +
      </button>
      <div style={{ width: 1, height: 20, backgroundColor: theme.toolbarBorder, margin: "0 2px" }} />
      <button
        onClick={onToggleRankdir}
        style={{ ...btnStyle, width: "auto", padding: "0 6px", fontSize: 10 }}
        title={`Layout: ${rankdir === "LR" ? "Left to Right" : "Top to Bottom"}`}
        onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
        onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlBg)}
      >
        {rankdir}
      </button>
    </div>
  );
}
