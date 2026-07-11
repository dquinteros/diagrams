import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";

interface ImportSqlModalProps {
  onImport: (sql: string, dialect: string) => void;
  onClose: () => void;
}

const DIALECTS = [
  { id: "postgres", label: "PostgreSQL" },
  { id: "mysql", label: "MySQL" },
  { id: "sqlite", label: "SQLite" },
  { id: "mssql", label: "SQL Server" },
];

export function ImportSqlModal({ onImport, onClose }: ImportSqlModalProps) {
  const { theme } = useTheme();
  const [sql, setSql] = useState("");
  const [dialect, setDialect] = useState("postgres");

  const btnStyle: React.CSSProperties = {
    background: theme.controlBg,
    border: `1px solid ${theme.controlBorder}`,
    color: theme.controlText,
    padding: "6px 14px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
  };

  return (
    <div
      // Close on mousedown that starts on the backdrop itself: a click that
      // starts inside the dialog (e.g. selecting text in the textarea) and is
      // released over the backdrop must not discard the modal.
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
          width: 640,
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "var(--font-mono)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: "bold", color: theme.toolbarText, fontSize: 14 }}>
            Import SQL
          </span>
          <div style={{ flex: 1 }} />
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            style={{
              background: theme.controlBg,
              border: `1px solid ${theme.controlBorder}`,
              color: theme.controlText,
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
          >
            {DIALECTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="Paste your CREATE TABLE statements here…"
          autoFocus
          spellCheck={false}
          style={{
            width: "100%",
            height: 280,
            resize: "vertical",
            background: theme.canvasBg,
            border: `1px solid ${theme.controlBorder}`,
            color: theme.columnText,
            padding: 10,
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnStyle}>
            Cancel
          </button>
          <button
            onClick={() => onImport(sql, dialect)}
            disabled={!sql.trim()}
            style={{
              ...btnStyle,
              background: theme.toolbarAccent,
              color: "#fff",
              opacity: sql.trim() ? 1 : 0.5,
              cursor: sql.trim() ? "pointer" : "not-allowed",
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
