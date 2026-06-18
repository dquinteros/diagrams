import type { Doc } from "../../hooks/useDocuments";
import { useTheme } from "../../context/ThemeContext";

interface TabBarProps {
  docs: Doc[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

function tabName(doc: Doc): string {
  if (!doc.filePath) return "Untitled";
  return doc.filePath.split("/").pop() ?? "Untitled";
}

export function TabBar({ docs, activeId, onSelect, onClose, onNew }: TabBarProps) {
  const { theme } = useTheme();

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
        overflowX: "auto",
      }}
    >
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
                fontSize: 14,
                lineHeight: 1,
                padding: "0 2px",
              }}
              title="Close (Cmd+W)"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        onClick={onNew}
        style={{
          background: "transparent",
          border: "none",
          color: theme.toolbarTextMuted,
          cursor: "pointer",
          fontSize: 16,
          padding: "0 12px",
        }}
        title="New tab (Cmd+T)"
      >
        +
      </button>
    </div>
  );
}
