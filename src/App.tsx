import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DbmlEditor, type DbmlEditorHandle } from "./components/Editor/DbmlEditor";
import { findTableAtOffset } from "./lib/findTableAtOffset";
import { DiagramCanvas } from "./components/Diagram/DiagramCanvas";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { ImportSqlModal } from "./components/Toolbar/ImportSqlModal";
import { exportSvg, exportPng, exportPdf } from "./lib/exportImage";
import { useDbmlParser } from "./hooks/useDbmlParser";
import { useDiagramLayout } from "./hooks/useDiagramLayout";
import { useFileOperations } from "./hooks/useFileOperations";
import { useTheme } from "./context/ThemeContext";
import type { DetailLevel } from "./types/layout";

const DEFAULT_CONTENT = `// Welcome to Diagrams — a local DBML editor
// Start typing your schema below

Table users {
  id integer [pk, increment]
  username varchar(50) [unique, not null]
  email varchar(255) [unique, not null]
  role varchar(20) [default: 'user']
  created_at timestamp [default: \`now()\`]

  Note: 'Stores user accounts'
}

Table posts {
  id integer [pk, increment]
  title varchar(255) [not null]
  body text
  status varchar(20) [default: 'draft']
  user_id integer [not null]
  created_at timestamp [default: \`now()\`]
}

Table comments {
  id integer [pk, increment]
  body text [not null]
  post_id integer [not null]
  user_id integer [not null]
  created_at timestamp [default: \`now()\`]
}

Table tags {
  id integer [pk, increment]
  name varchar(100) [unique, not null]
}

Table post_tags {
  post_id integer [not null]
  tag_id integer [not null]

  indexes {
    (post_id, tag_id) [unique]
  }
}

Ref: posts.user_id > users.id [delete: cascade]
Ref: comments.post_id > posts.id [delete: cascade]
Ref: comments.user_id > users.id
Ref: post_tags.post_id > posts.id [delete: cascade]
Ref: post_tags.tag_id > tags.id [delete: cascade]

Enum post_status {
  draft
  published
  archived
}
`;

function App() {
  const { theme } = useTheme();
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [editorKey, setEditorKey] = useState(0);
  const [rankdir, setRankdir] = useState<"LR" | "TB">("LR");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("full");
  const [highlightedTable, setHighlightedTable] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const editorRef = useRef<DbmlEditorHandle>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { schema, parseError, isLoading } = useDbmlParser(content);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const layout = useDiagramLayout(schema, rankdir);
  const fileOps = useFileOperations();
  const contentRef = useRef(content);
  contentRef.current = content;

  const [dividerPos, setDividerPos] = useState(40);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      fileOps.setDirty(true);
    },
    [fileOps]
  );

  const handleOpen = useCallback(async () => {
    const result = await fileOps.openFile();
    if (result) {
      setContent(result.content);
      setEditorKey((k) => k + 1);
    }
  }, [fileOps]);

  const handleSave = useCallback(() => {
    fileOps.saveFile(contentRef.current);
  }, [fileOps]);

  const handleSaveAs = useCallback(() => {
    fileOps.saveFileAs(contentRef.current);
  }, [fileOps]);

  const handleExportSql = useCallback(
    async (dialect: string) => {
      try {
        const sql = await invoke<string>("generate_sql", {
          input: contentRef.current,
          dialect,
        });
        await fileOps.exportSql(sql, dialect);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Export failed: ${msg}`);
      }
    },
    [fileOps]
  );

  const handleExportSvg = useCallback(() => {
    try {
      exportSvg(layout.width, layout.height);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Export failed: ${msg}`);
    }
  }, [layout.width, layout.height]);

  const handleExportPng = useCallback(async () => {
    try {
      await exportPng(layout.width, layout.height, theme.canvasBg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Export failed: ${msg}`);
    }
  }, [layout.width, layout.height, theme.canvasBg]);

  const handleExportPdf = useCallback(async () => {
    try {
      await exportPdf(layout.width, layout.height, theme.canvasBg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Export failed: ${msg}`);
    }
  }, [layout.width, layout.height, theme.canvasBg]);

  const applyImportedDbml = useCallback(
    (dbml: string) => {
      setContent(dbml);
      setEditorKey((k) => k + 1);
      fileOps.setDirty(true);
    },
    [fileOps]
  );

  const handleImportFile = useCallback(
    async (dialect: string) => {
      try {
        const sql = await fileOps.openSqlFile();
        if (sql == null) return;
        const dbml = await fileOps.importSql(sql, dialect);
        applyImportedDbml(dbml);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Import failed: ${msg}`);
      }
    },
    [fileOps, applyImportedDbml]
  );

  const handleImportSqlConfirm = useCallback(
    async (sql: string, dialect: string) => {
      try {
        const dbml = await fileOps.importSql(sql, dialect);
        applyImportedDbml(dbml);
        setShowImportModal(false);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Import failed: ${msg}`);
      }
    },
    [fileOps, applyImportedDbml]
  );

  const toggleRankdir = useCallback(() => {
    setRankdir((prev) => (prev === "LR" ? "TB" : "LR"));
  }, []);

  const handleCursorChange = useCallback(
    (offset: number) => {
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(() => {
        if (!schema) return;
        const tableName = findTableAtOffset(schema, offset);
        setHighlightedTable(tableName);
      }, 100);
    },
    [schema]
  );

  const handleNavigateToSource = useCallback(
    (spanRange: [number, number]) => {
      editorRef.current?.scrollToOffset(spanRange[0]);
    },
    []
  );

  const toggleDetailLevel = useCallback(() => {
    setDetailLevel((prev) => {
      const levels: DetailLevel[] = ["full", "keys-only", "name-only"];
      const idx = levels.indexOf(prev);
      return levels[(idx + 1) % levels.length];
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "o") {
          e.preventDefault();
          handleOpen();
        } else if (e.key === "s" && e.shiftKey) {
          e.preventDefault();
          handleSaveAs();
        } else if (e.key === "s") {
          e.preventDefault();
          handleSave();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpen, handleSave, handleSaveAs]);

  const handleDividerMouseDown = useCallback(() => {
    setIsDraggingDivider(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingDivider) return;
      const pct = (e.clientX / window.innerWidth) * 100;
      setDividerPos(Math.max(15, Math.min(85, pct)));
    },
    [isDraggingDivider]
  );

  const handleMouseUp = useCallback(() => {
    setIsDraggingDivider(false);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: theme.canvasBg,
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Toolbar
        parseError={parseError}
        isLoading={isLoading}
        tableCount={schema?.tables.length ?? 0}
        refCount={schema?.refs.length ?? 0}
        filePath={fileOps.filePath}
        isDirty={fileOps.isDirty}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportSql={handleExportSql}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onImportFile={handleImportFile}
        onPasteSql={() => setShowImportModal(true)}
      />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div
          style={{
            width: `${dividerPos}%`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <DbmlEditor
            ref={editorRef}
            key={editorKey}
            initialValue={content}
            onChange={handleContentChange}
            onCursorChange={handleCursorChange}
            parseError={parseError}
            schemaRef={schemaRef}
          />
        </div>
        <div
          onMouseDown={handleDividerMouseDown}
          style={{
            width: 4,
            backgroundColor: isDraggingDivider ? theme.dividerActive : theme.divider,
            cursor: "col-resize",
            flexShrink: 0,
            transition: isDraggingDivider ? "none" : "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!isDraggingDivider)
              (e.target as HTMLElement).style.backgroundColor = theme.dividerHover;
          }}
          onMouseLeave={(e) => {
            if (!isDraggingDivider)
              (e.target as HTMLElement).style.backgroundColor = theme.divider;
          }}
        />
        <div style={{ flex: 1, overflow: "hidden" }}>
          {schema && (
            <DiagramCanvas
              schema={schema}
              layout={layout}
              rankdir={rankdir}
              onToggleRankdir={toggleRankdir}
              detailLevel={detailLevel}
              onToggleDetailLevel={toggleDetailLevel}
              highlightedTable={highlightedTable}
              onNavigateToSource={handleNavigateToSource}
              storageKey={fileOps.filePath ?? "untitled"}
            />
          )}
        </div>
      </div>
      {showImportModal && (
        <ImportSqlModal
          onImport={handleImportSqlConfirm}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}

export default App;
