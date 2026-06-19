import type { ParseError } from "../../types/schema";
import { ExportMenu } from "./ExportMenu";
import { ImportMenu } from "./ImportMenu";
import { RecentMenu } from "./RecentMenu";
import { useTheme } from "../../context/ThemeContext";
import {
  IconSun,
  IconMoon,
  IconFolderOpen,
  IconSave,
  IconSaveAs,
  IconAutosave,
} from "../icons";

interface ToolbarProps {
  parseError: ParseError | null;
  isLoading: boolean;
  stats: string;
  filePath: string | null;
  isDirty: boolean;
  recentFiles: string[];
  autosave: boolean;
  isSaving: boolean;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onToggleAutosave: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportSql: (dialect: string) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onImportFile: (dialect: string) => void;
  onPasteSql: () => void;
}

export function Toolbar({
  parseError,
  isLoading,
  stats,
  filePath,
  isDirty,
  recentFiles,
  autosave,
  isSaving,
  onOpen,
  onOpenRecent,
  onToggleAutosave,
  onSave,
  onSaveAs,
  onExportSql,
  onExportSvg,
  onExportPng,
  onExportPdf,
  onImportFile,
  onPasteSql,
}: ToolbarProps) {
  const { theme, themeId, toggleTheme } = useTheme();

  const fileName = filePath
    ? filePath.split("/").pop() ?? "Untitled"
    : "Untitled";

  const iconBtnStyle: React.CSSProperties = {
    background: theme.controlBg,
    border: `1px solid ${theme.controlBorder}`,
    color: theme.controlText,
    padding: 6,
    borderRadius: 4,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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
      <span style={{ color: theme.toolbarTextMuted }}>{stats}</span>

      <div style={{ flex: 1 }} />

      {isSaving && <span style={{ color: theme.toolbarTextMuted }}>saving…</span>}
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
          style={iconBtnStyle}
          title={`Switch to ${themeId === "dark" ? "light" : "dark"} mode`}
          aria-label="Toggle theme"
        >
          {themeId === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        <button onClick={onOpen} style={iconBtnStyle} title="Open (Cmd+O)" aria-label="Open file">
          <IconFolderOpen />
        </button>
        <RecentMenu files={recentFiles} onOpenRecent={onOpenRecent} />
        <button onClick={onSave} style={iconBtnStyle} title="Save (Cmd+S)" aria-label="Save">
          <IconSave />
        </button>
        <button onClick={onSaveAs} style={iconBtnStyle} title="Save As (Cmd+Shift+S)" aria-label="Save As">
          <IconSaveAs />
        </button>
        <button
          onClick={onToggleAutosave}
          style={{
            ...iconBtnStyle,
            color: autosave ? theme.toolbarAccent : theme.toolbarTextMuted,
            borderColor: autosave ? theme.toolbarAccent : theme.controlBorder,
          }}
          title={`Autosave ${autosave ? "on" : "off"} (saved files only)`}
          aria-label="Toggle autosave"
        >
          <IconAutosave />
        </button>
        <ImportMenu onImportFile={onImportFile} onPasteSql={onPasteSql} />
        <ExportMenu
          onExportSql={onExportSql}
          onExportSvg={onExportSvg}
          onExportPng={onExportPng}
          onExportPdf={onExportPdf}
        />
      </div>
    </div>
  );
}
