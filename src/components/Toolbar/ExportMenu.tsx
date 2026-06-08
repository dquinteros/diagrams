import { useState, useRef, useEffect } from "react";

interface ExportMenuProps {
  onExportSql: (dialect: string) => void;
  onExportSvg: () => void;
}

const DIALECTS = [
  { id: "postgres", label: "PostgreSQL" },
  { id: "mysql", label: "MySQL" },
  { id: "sqlite", label: "SQLite" },
  { id: "mssql", label: "SQL Server" },
];

export function ExportMenu({ onExportSql, onExportSvg }: ExportMenuProps) {
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
        style={buttonStyle}
      >
        Export
      </button>
      {isOpen && (
        <div style={menuStyle}>
          <div style={menuHeaderStyle}>Export SQL</div>
          {DIALECTS.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                onExportSql(d.id);
                setIsOpen(false);
              }}
              style={menuItemStyle}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.backgroundColor = "#45475a")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.backgroundColor = "transparent")
              }
            >
              {d.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #45475a", margin: "4px 0" }} />
          <div style={menuHeaderStyle}>Export Image</div>
          <button
            onClick={() => {
              onExportSvg();
              setIsOpen(false);
            }}
            style={menuItemStyle}
            onMouseEnter={(e) =>
              ((e.target as HTMLElement).style.backgroundColor = "#45475a")
            }
            onMouseLeave={(e) =>
              ((e.target as HTMLElement).style.backgroundColor = "transparent")
            }
          >
            SVG
          </button>
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #45475a",
  color: "#cdd6f4",
  padding: "4px 12px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "monospace",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: 4,
  backgroundColor: "#1e1e2e",
  border: "1px solid #45475a",
  borderRadius: 6,
  padding: "4px 0",
  minWidth: 160,
  zIndex: 100,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
};

const menuHeaderStyle: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: 10,
  color: "#6c7086",
  textTransform: "uppercase",
  letterSpacing: 1,
  fontFamily: "monospace",
};

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "transparent",
  border: "none",
  color: "#cdd6f4",
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "monospace",
  textAlign: "left",
};
