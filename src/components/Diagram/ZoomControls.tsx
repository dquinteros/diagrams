import type { DetailLevel } from "../../types/layout";
import { useTheme } from "../../context/ThemeContext";

interface ZoomControlsProps {
  zoomPercentage: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  rankdir: "LR" | "TB";
  onToggleRankdir: () => void;
  detailLevel: DetailLevel;
  onToggleDetailLevel: () => void;
  onResetLayout: () => void;
}

const DETAIL_LABELS: Record<DetailLevel, string> = {
  full: "All",
  "keys-only": "Keys",
  "name-only": "Name",
};

export function ZoomControls({
  zoomPercentage,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  rankdir,
  onToggleRankdir,
  detailLevel,
  onToggleDetailLevel,
  onResetLayout,
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

  const hover = (e: React.MouseEvent, enter: boolean) => {
    (e.target as HTMLElement).style.backgroundColor = enter
      ? theme.controlHoverBg
      : theme.controlBg;
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
        onMouseEnter={(e) => hover(e, true)}
        onMouseLeave={(e) => hover(e, false)}
      >
        {"⊡"}
      </button>
      <button
        onClick={onZoomOut}
        style={btnStyle}
        title="Zoom out"
        onMouseEnter={(e) => hover(e, true)}
        onMouseLeave={(e) => hover(e, false)}
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
        onMouseEnter={(e) => hover(e, true)}
        onMouseLeave={(e) => hover(e, false)}
      >
        +
      </button>
      <div style={{ width: 1, height: 20, backgroundColor: theme.toolbarBorder, margin: "0 2px" }} />
      <button
        onClick={onToggleRankdir}
        style={{ ...btnStyle, width: "auto", padding: "0 6px", fontSize: 10 }}
        title={`Layout: ${rankdir === "LR" ? "Left to Right" : "Top to Bottom"}`}
        onMouseEnter={(e) => hover(e, true)}
        onMouseLeave={(e) => hover(e, false)}
      >
        {rankdir}
      </button>
      <button
        onClick={onToggleDetailLevel}
        style={{ ...btnStyle, width: "auto", padding: "0 6px", fontSize: 10 }}
        title={`Detail: ${DETAIL_LABELS[detailLevel]}`}
        onMouseEnter={(e) => hover(e, true)}
        onMouseLeave={(e) => hover(e, false)}
      >
        {DETAIL_LABELS[detailLevel]}
      </button>
      <button
        onClick={onResetLayout}
        style={{ ...btnStyle, width: "auto", padding: "0 6px", fontSize: 10 }}
        title="Reset layout (undo manual positioning)"
        onMouseEnter={(e) => hover(e, true)}
        onMouseLeave={(e) => hover(e, false)}
      >
        Reset
      </button>
    </div>
  );
}
