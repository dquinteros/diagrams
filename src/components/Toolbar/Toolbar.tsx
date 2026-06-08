import type { ParseError } from "../../types/schema";
import { ExportMenu } from "./ExportMenu";

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
  const fileName = filePath
    ? filePath.split("/").pop() ?? "Untitled"
    : "Untitled";

  return (
    <div
      style={{
        height: 40,
        backgroundColor: "#181825",
        borderBottom: "1px solid #313244",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
        fontFamily: "monospace",
        fontSize: 13,
        color: "#cdd6f4",
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: "bold", color: "#89b4fa" }}>Diagrams</span>
      <span style={{ color: "#585b70" }}>|</span>
      <span style={{ color: "#6c7086" }}>
        {fileName}
        {isDirty ? " *" : ""}
      </span>
      <span style={{ color: "#585b70" }}>|</span>
      <span style={{ color: "#6c7086" }}>
        {tableCount} tables, {refCount} refs
      </span>

      <div style={{ flex: 1 }} />

      {isLoading && <span style={{ color: "#f9e2af" }}>parsing...</span>}
      {parseError && (
        <span
          style={{
            color: "#f38ba8",
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
        <button onClick={onOpen} style={btnStyle} title="Open (Cmd+O)">
          Open
        </button>
        <button onClick={onSave} style={btnStyle} title="Save (Cmd+S)">
          Save
        </button>
        <button onClick={onSaveAs} style={btnStyle} title="Save As (Cmd+Shift+S)">
          Save As
        </button>
        <ExportMenu onExportSql={onExportSql} onExportSvg={onExportSvg} />
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #45475a",
  color: "#cdd6f4",
  padding: "4px 12px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "monospace",
};
