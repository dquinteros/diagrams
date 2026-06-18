import { useState, useRef, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";

interface RecentMenuProps {
  files: string[];
  onOpenRecent: (path: string) => void;
}

export function RecentMenu({ files, onOpenRecent }: RecentMenuProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={files.length === 0}
        style={{
          background: theme.controlBg,
          border: `1px solid ${theme.controlBorder}`,
          color: theme.controlText,
          padding: "4px 12px",
          borderRadius: 4,
          cursor: files.length === 0 ? "not-allowed" : "pointer",
          opacity: files.length === 0 ? 0.5 : 1,
          fontSize: 12,
          fontFamily: "monospace",
        }}
        title="Open recent files"
      >
        Recent
      </button>
      {isOpen && files.length > 0 && (
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
            minWidth: 240,
            maxWidth: 420,
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {files.map((path) => (
            <button
              key={path}
              onClick={() => {
                onOpenRecent(path);
                setIsOpen(false);
              }}
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
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                direction: "rtl",
              }}
              title={path}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "transparent")}
            >
              {path}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
