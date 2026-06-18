import { useState, useRef, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";

interface ExportMenuProps {
  onExportSql: (dialect: string) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
}

const DIALECTS = [
  { id: "postgres", label: "PostgreSQL" },
  { id: "mysql", label: "MySQL" },
  { id: "sqlite", label: "SQLite" },
  { id: "mssql", label: "SQL Server" },
];

const IMAGE_FORMATS = [
  { id: "svg", label: "SVG" },
  { id: "png", label: "PNG" },
  { id: "pdf", label: "PDF" },
];

export function ExportMenu({ onExportSql, onExportSvg, onExportPng, onExportPdf }: ExportMenuProps) {
  const { theme } = useTheme();
  const imageHandlers: Record<string, () => void> = {
    svg: onExportSvg,
    png: onExportPng,
    pdf: onExportPdf,
  };
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

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: theme.controlBg,
          border: `1px solid ${theme.controlBorder}`,
          color: theme.controlText,
          padding: "4px 12px",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "monospace",
        }}
      >
        Export
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
            minWidth: 160,
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ padding: "4px 12px", fontSize: 10, color: theme.toolbarTextMuted, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace" }}>
            Export SQL
          </div>
          {DIALECTS.map((d) => (
            <button
              key={d.id}
              onClick={() => { onExportSql(d.id); setIsOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                background: "transparent",
                border: "none",
                color: theme.controlText,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "monospace",
                textAlign: "left",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "transparent")}
            >
              {d.label}
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${theme.controlBorder}`, margin: "4px 0" }} />
          <div style={{ padding: "4px 12px", fontSize: 10, color: theme.toolbarTextMuted, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace" }}>
            Export Image
          </div>
          {IMAGE_FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => { imageHandlers[f.id](); setIsOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                background: "transparent",
                border: "none",
                color: theme.controlText,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "monospace",
                textAlign: "left",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "transparent")}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
