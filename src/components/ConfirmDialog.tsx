import { useTheme } from "../context/ThemeContext";

export interface ConfirmButton {
  label: string;
  variant?: "primary" | "danger" | "default";
  onClick: () => void;
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  buttons: ConfirmButton[];
  onClose: () => void;
}

export function ConfirmDialog({ title, message, buttons, onClose }: ConfirmDialogProps) {
  const { theme } = useTheme();

  const styleFor = (variant: ConfirmButton["variant"]): React.CSSProperties => {
    const base: React.CSSProperties = {
      border: `1px solid ${theme.controlBorder}`,
      padding: "6px 14px",
      borderRadius: 4,
      cursor: "pointer",
      fontSize: 12,
      fontFamily: "var(--font-mono)",
    };
    if (variant === "primary") {
      return { ...base, background: theme.toolbarAccent, color: "#fff", borderColor: theme.toolbarAccent };
    }
    if (variant === "danger") {
      return { ...base, background: "transparent", color: theme.errorText, borderColor: theme.errorText };
    }
    return { ...base, background: theme.controlBg, color: theme.controlText };
  };

  return (
    <div
      // Close on mousedown that starts on the backdrop itself, so a click
      // started inside the dialog and released outside doesn't dismiss it.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.tableBg,
          border: `1px solid ${theme.controlBorder}`,
          borderRadius: 8,
          padding: 20,
          width: 440,
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontFamily: "var(--font-mono)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <span style={{ fontWeight: "bold", color: theme.toolbarText, fontSize: 14 }}>
          {title}
        </span>
        <span style={{ color: theme.columnText, fontSize: 12, whiteSpace: "pre-wrap" }}>
          {message}
        </span>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {buttons.map((b) => (
            <button key={b.label} onClick={b.onClick} style={styleFor(b.variant)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
