import type { ParseError } from "../../types/schema";
import { ExportMenu } from "./ExportMenu";
import { useTheme } from "../../context/ThemeContext";

interface ToolbarProps {
  parseError: ParseError | null;
  isLoading: boolean;
  tableCount: number;
  refCount: number;
  filePath: string | null;
  isDirty: boolean;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportSql: (dialect: string) => void;
  onExportSvg: () => void;
}

export function Toolbar({
  parseError,
  isLoading,
  tableCount,
  refCount,
  filePath,
  isDirty,
  onOpen,
  onSave,
  onSaveAs,
  onExportSql,
  onExportSvg,
}: ToolbarProps) {
  const { theme, themeId, toggleTheme } = useTheme();

  const fileName = filePath
    ? filePath.split("/").pop() ?? "Untitled"
    : "Untitled";

  const btnStyle: React.CSSProperties = {
    background: theme.controlBg,
    border: `1px solid ${theme.controlBorder}`,
    color: theme.controlText,
    padding: "4px 12px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "monospace",
  };

  return (
    <div
      style={{
        height: 40,
        backgroundColor: theme.toolbarBg,
        borderBottom: `1px solid ${theme.toolbarBorder}`,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
        fontFamily: "monospace",
        fontSize: 13,
        color: theme.toolbarText,
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: "bold", color: theme.toolbarAccent }}>Diagrams</span>
      <span style={{ color: theme.toolbarSeparator }}>|</span>
      <span style={{ color: theme.toolbarTextMuted }}>
        {fileName}
        {isDirty ? " *" : ""}
      </span>
      <span style={{ color: theme.toolbarSeparator }}>|</span>
      <span style={{ color: theme.toolbarTextMuted }}>
        {tableCount} tables, {refCount} refs
      </span>

      <div style={{ flex: 1 }} />

      {isLoading && <span style={{ color: theme.warningText }}>parsing...</span>}
      {parseError && (
        <span
          style={{
            color: theme.errorText,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 300,
          }}
          title={parseError.message}
        >
          {parseError.message.split("\n")[0]}
        </span>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={toggleTheme}
          style={btnStyle}
          title={`Switch to ${themeId === "dark" ? "light" : "dark"} mode`}
        >
          {themeId === "dark" ? "Light" : "Dark"}
        </button>
        <button onClick={onOpen} style={btnStyle} title="Open (Cmd+O)">Open</button>
        <button onClick={onSave} style={btnStyle} title="Save (Cmd+S)">Save</button>
        <button onClick={onSaveAs} style={btnStyle} title="Save As (Cmd+Shift+S)">Save As</button>
        <ExportMenu onExportSql={onExportSql} onExportSvg={onExportSvg} />
      </div>
    </div>
  );
}
