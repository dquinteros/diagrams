import { useState, useRef, useEffect } from "react";
import type { Doc } from "../../hooks/useDocuments";
import { useTheme } from "../../context/ThemeContext";
import { IconPlus, IconClose } from "../icons";
import { ENABLED_TYPES, DIAGRAM_TYPES, type DiagramType } from "../../lib/diagramTypes";

interface TabBarProps {
  docs: Doc[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: (type: DiagramType) => void;
}

function tabName(doc: Doc): string {
  if (!doc.filePath) return "Untitled";
  return doc.filePath.split("/").pop() ?? "Untitled";
}

export function TabBar({ docs, activeId, onSelect, onClose, onNew }: TabBarProps) {
  const { theme } = useTheme();
  const [newOpen, setNewOpen] = useState(false);
  const newRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (newRef.current && !newRef.current.contains(e.target as Node)) setNewOpen(false);
    }
    if (newOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [newOpen]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        backgroundColor: theme.toolbarBg,
        borderBottom: `1px solid ${theme.toolbarBorder}`,
        height: 32,
        fontFamily: "monospace",
        fontSize: 12,
        flexShrink: 0,
        // NOTE: no overflow here — it would clip the new-tab dropdown. The
        // scrollable region is the inner tabs container below.
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", overflowX: "auto", minWidth: 0 }}>
      {docs.map((doc) => {
        const isActive = doc.id === activeId;
        return (
          <div
            key={doc.id}
            onClick={() => onSelect(doc.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 10px",
              cursor: "pointer",
              borderRight: `1px solid ${theme.toolbarBorder}`,
              backgroundColor: isActive ? theme.editorBg : "transparent",
              color: isActive ? theme.toolbarText : theme.toolbarTextMuted,
              whiteSpace: "nowrap",
              maxWidth: 200,
            }}
            title={doc.filePath ?? "Untitled"}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {tabName(doc)}
              {doc.isDirty ? " •" : ""}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(doc.id);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: theme.toolbarTextMuted,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 2px",
              }}
              title="Close (Cmd+W)"
              aria-label="Close tab"
            >
              <IconClose size={14} />
            </button>
          </div>
        );
      })}
      </div>
      <div ref={newRef} style={{ position: "relative", display: "inline-flex" }}>
        <button
          onClick={() => setNewOpen((o) => !o)}
          style={{
            background: "transparent",
            border: "none",
            color: theme.toolbarTextMuted,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            padding: "0 12px",
          }}
          title="New tab (Cmd+T)"
          aria-label="New tab"
        >
          <IconPlus size={16} />
        </button>
        {newOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 4,
              marginTop: 2,
              backgroundColor: theme.tableBg,
              border: `1px solid ${theme.controlBorder}`,
              borderRadius: 6,
              padding: "4px 0",
              minWidth: 140,
              zIndex: 100,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            {ENABLED_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => {
                  onNew(t);
                  setNewOpen(false);
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
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = theme.controlHoverBg)}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "transparent")}
              >
                New {DIAGRAM_TYPES[t].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
