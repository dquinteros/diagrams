import { useState, useRef, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { IconImport } from "../icons";

interface ImportMenuProps {
  onImportFile: (dialect: string) => void;
  onPasteSql: () => void;
}

const DIALECTS = [
  { id: "postgres", label: "PostgreSQL" },
  { id: "mysql", label: "MySQL" },
  { id: "sqlite", label: "SQLite" },
  { id: "mssql", label: "SQL Server" },
];

export function ImportMenu({ onImportFile, onPasteSql }: ImportMenuProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const sectionStyle: React.CSSProperties = {
    padding: "4px 12px",
    fontSize: 10,
    color: theme.toolbarTextMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "var(--font-mono)",
  };

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    background: "transparent",
    border: "none",
    color: theme.controlText,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    textAlign: "left",
  };

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Import SQL"
        aria-label="Import SQL"
        style={{
          background: theme.controlBg,
          border: `1px solid ${theme.controlBorder}`,
          color: theme.controlText,
          padding: 6,
          borderRadius: 4,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconImport />
      </button>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            backgroundColor: theme.tableBg,
            border: `1px solid ${theme.controlBorder}`,
            borderRadius: 6,
            padding: "4px 0",
            minWidth: 180,
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          <button
            onClick={() => {
              onPasteSql();
              setIsOpen(false);
            }}
            style={itemStyle}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "transparent")}
          >
            Paste SQL…
          </button>
          <div style={{ borderTop: `1px solid ${theme.controlBorder}`, margin: "4px 0" }} />
          <div style={sectionStyle}>Import from file</div>
          {DIALECTS.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                onImportFile(d.id);
                setIsOpen(false);
              }}
              style={itemStyle}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "transparent")}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
