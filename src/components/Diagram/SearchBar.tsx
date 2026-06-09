import { useState, useCallback, useRef, useEffect } from "react";
import type { SchemaIR } from "../../types/schema";
import type { LayoutNode } from "../../types/layout";
import { useTheme } from "../../context/ThemeContext";

interface SearchBarProps {
  schema: SchemaIR;
  nodes: Map<string, LayoutNode>;
  onNavigateToTable: (node: LayoutNode) => void;
  onHighlight: (tableName: string | null) => void;
}

export function SearchBar({
  schema,
  nodes,
  onNavigateToTable,
  onHighlight,
}: SearchBarProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = query.length > 0
    ? schema.tables.filter((t) =>
        t.name.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleSelect = useCallback(
    (tableName: string) => {
      const node = nodes.get(tableName);
      if (node) {
        onNavigateToTable(node);
        onHighlight(tableName);
      }
      setIsOpen(false);
      setQuery("");
    },
    [nodes, onNavigateToTable, onHighlight]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        backgroundColor: theme.toolbarBg,
        border: `1px solid ${theme.toolbarBorder}`,
        borderRadius: 6,
        padding: 4,
        minWidth: 220,
        zIndex: 100,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches.length > 0) {
            handleSelect(matches[0].name);
          }
        }}
        placeholder="Search tables... (Cmd+P)"
        style={{
          width: "100%",
          backgroundColor: theme.editorBg,
          border: `1px solid ${theme.controlBorder}`,
          borderRadius: 4,
          padding: "6px 8px",
          color: theme.toolbarText,
          fontSize: 12,
          fontFamily: "monospace",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {matches.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
          {matches.map((t) => (
            <button
              key={t.name}
              onClick={() => handleSelect(t.name)}
              style={{
                display: "block",
                width: "100%",
                background: "transparent",
                border: "none",
                color: theme.controlText,
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "monospace",
                textAlign: "left",
                borderRadius: 2,
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.backgroundColor = "transparent")
              }
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
