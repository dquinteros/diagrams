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
  showSqlActions: boolean;
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
  showSqlActions,
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

  // Split on both separators — Windows paths use backslashes.
  const fileName = filePath
    ? filePath.split(/[\\/]/).pop() ?? "Untitled"
    : "Untitled";

  const iconBtnStyle: React.CSSProperties = {
    background: theme.controlBg,
    border: `1px solid transparent`,
    color: theme.controlText,
    padding: 6,
    borderRadius: 5,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.12s, border-color 0.12s",
  };

  // Icon buttons stay quiet until hovered — the accent belongs to the artwork.
  const hoverOn = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = theme.controlHoverBg;
  };
  const hoverOff = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
  };

  const rule = (
    <span
      aria-hidden
      style={{ width: 1, height: 14, backgroundColor: theme.toolbarSeparator, flexShrink: 0 }}
    />
  );

  return (
    <div
      style={{
        height: 40,
        backgroundColor: theme.toolbarBg,
        borderBottom: `1px solid ${theme.toolbarBorder}`,
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        gap: 12,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: theme.toolbarText,
        flexShrink: 0,
      }}
    >
      {/* Brand: registration/crosshair mark — drafting vernacular for "align here". */}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <RegistrationMark color={theme.toolbarAccent} />
        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            fontWeight: 600,
            fontSize: 12,
            color: theme.toolbarText,
          }}
        >
          Diagrams
        </span>
      </span>
      {rule}
      <span className="instrument-label" style={{ color: theme.toolbarTextMuted, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {fileName}
        {isDirty && (
          <span
            aria-label="unsaved changes"
            title="Unsaved changes"
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: theme.toolbarAccent }}
          />
        )}
      </span>
      {rule}
      <span className="instrument-label" style={{ color: theme.toolbarTextMuted }}>{stats}</span>

      <div style={{ flex: 1 }} />

      {isSaving && (
        <span className="instrument-label" style={{ color: theme.toolbarTextMuted }}>saving…</span>
      )}
      {isLoading && (
        <span className="instrument-label" style={{ color: theme.warningText }}>parsing…</span>
      )}
      {parseError && (
        <span
          style={{
            color: theme.errorText,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 300,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
          title={parseError.message}
        >
          {/* Redline: red appears only as markup on a faulty drawing. */}
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: theme.errorText,
              flexShrink: 0,
            }}
          />
          {parseError.message.split("\n")[0]}
        </span>
      )}

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          onClick={toggleTheme}
          style={iconBtnStyle}
          onMouseEnter={hoverOn}
          onMouseLeave={hoverOff}
          title={`Switch to ${themeId === "dark" ? "light" : "dark"} mode`}
          aria-label="Toggle theme"
        >
          {themeId === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        <button onClick={onOpen} style={iconBtnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} title="Open (Cmd+O)" aria-label="Open file">
          <IconFolderOpen />
        </button>
        <RecentMenu files={recentFiles} onOpenRecent={onOpenRecent} />
        <button onClick={onSave} style={iconBtnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} title="Save (Cmd+S)" aria-label="Save">
          <IconSave />
        </button>
        <button onClick={onSaveAs} style={iconBtnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} title="Save As (Cmd+Shift+S)" aria-label="Save As">
          <IconSaveAs />
        </button>
        <button
          onClick={onToggleAutosave}
          style={{
            ...iconBtnStyle,
            color: autosave ? theme.toolbarAccent : theme.toolbarTextMuted,
          }}
          onMouseEnter={hoverOn}
          onMouseLeave={hoverOff}
          title={`Autosave ${autosave ? "on" : "off"} (saved files only)`}
          aria-label="Toggle autosave"
        >
          <IconAutosave />
        </button>
        {showSqlActions && (
          <ImportMenu onImportFile={onImportFile} onPasteSql={onPasteSql} />
        )}
        <ExportMenu
          showSql={showSqlActions}
          onExportSql={onExportSql}
          onExportSvg={onExportSvg}
          onExportPng={onExportPng}
          onExportPdf={onExportPdf}
        />
      </div>
    </div>
  );
}

/** Registration/crosshair mark — the brand as a plotter alignment target. */
function RegistrationMark({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx={8} cy={8} r={4} fill="none" stroke={color} strokeWidth={1.25} />
      <line x1={8} y1={0} x2={8} y2={4} stroke={color} strokeWidth={1.25} />
      <line x1={8} y1={12} x2={8} y2={16} stroke={color} strokeWidth={1.25} />
      <line x1={0} y1={8} x2={4} y2={8} stroke={color} strokeWidth={1.25} />
      <line x1={12} y1={8} x2={16} y2={8} stroke={color} strokeWidth={1.25} />
      <circle cx={8} cy={8} r={1} fill={color} />
    </svg>
  );
}
