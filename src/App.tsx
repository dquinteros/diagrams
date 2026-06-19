import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DbmlEditor, type DbmlEditorHandle } from "./components/Editor/DbmlEditor";
import { findTableAtOffset } from "./lib/findTableAtOffset";
import { DiagramCanvas } from "./components/Diagram/DiagramCanvas";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { TabBar } from "./components/Toolbar/TabBar";
import { ImportSqlModal } from "./components/Toolbar/ImportSqlModal";
import { ConfirmDialog, type ConfirmButton } from "./components/ConfirmDialog";
import { exportSvg, exportPng, exportPdf } from "./lib/exportImage";
import {
  loadRankdir,
  saveRankdir,
  loadDetailLevel,
  saveDetailLevel,
  loadRecentFiles,
  addRecentFile,
  removeRecentFile,
  loadAutosave,
  saveAutosave,
} from "./lib/prefs";
import { saveSession } from "./lib/session";
import { useDbmlParser } from "./hooks/useDbmlParser";
import { useDiagramLayout } from "./hooks/useDiagramLayout";
import { useFileOperations } from "./hooks/useFileOperations";
import { useDocuments, type Doc } from "./hooks/useDocuments";
import { useTheme } from "./context/ThemeContext";
import type { DetailLevel } from "./types/layout";

const DEFAULT_CONTENT = `// Welcome to Diagrams — a local DBML editor
// Start typing your schema below

Table users {
  id integer [pk, increment]
  username varchar(50) [unique, not null]
  email varchar(255) [unique, not null]
  role varchar(20) [default: 'user', check: \`role in ('user','admin')\`]
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

Note schema_info {
  'Blog demo schema. Drag tables to rearrange; the layout is saved per file.'
}
`;

function App() {
  const { theme } = useTheme();
  const docs = useDocuments(DEFAULT_CONTENT);
  const { activeDoc, activeId } = docs;
  const content = activeDoc.content;

  const [rankdir, setRankdir] = useState<"LR" | "TB">(loadRankdir);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(loadDetailLevel);
  const [highlightedTable, setHighlightedTable] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecentFiles);
  const [autosave, setAutosave] = useState<boolean>(loadAutosave);
  const [isSaving, setIsSaving] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    buttons: ConfirmButton[];
  } | null>(null);
  const editorRef = useRef<DbmlEditorHandle>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { schema, parseError, isLoading } = useDbmlParser(content);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const layout = useDiagramLayout(schema, rankdir, detailLevel);
  const fileOps = useFileOperations();

  const [dividerPos, setDividerPos] = useState(40);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  const rememberRecent = useCallback((path: string) => {
    setRecentFiles(addRecentFile(path));
  }, []);

  const handleContentChange = useCallback(
    (value: string) => {
      docs.updateContent(activeId, value);
    },
    [docs, activeId]
  );

  const handleOpen = useCallback(async () => {
    const result = await fileOps.openFile();
    if (result) {
      docs.openDoc(result.path, result.content);
      rememberRecent(result.path);
    }
  }, [fileOps, docs, rememberRecent]);

  const handleOpenRecent = useCallback(
    async (path: string) => {
      try {
        const content = await fileOps.readFile(path);
        if (content != null) {
          docs.openDoc(path, content);
          rememberRecent(path);
        }
      } catch {
        // The file was moved or deleted: drop it from the recents list.
        setRecentFiles(removeRecentFile(path));
        alert(`File no longer available — removed from Recent:\n${path}`);
      }
    },
    [fileOps, docs, rememberRecent]
  );

  const saveDoc = useCallback(
    async (doc: Doc): Promise<string | null> => {
      const saved = await fileOps.saveFile(doc.content, doc.filePath);
      if (saved) {
        docs.markSaved(doc.id, saved);
        rememberRecent(saved);
      }
      return saved;
    },
    [fileOps, docs, rememberRecent]
  );

  const handleSave = useCallback(() => saveDoc(activeDoc), [saveDoc, activeDoc]);

  const handleSaveAs = useCallback(async () => {
    const saved = await fileOps.saveFile(activeDoc.content, null);
    if (saved) {
      docs.markSaved(activeId, saved);
      rememberRecent(saved);
    }
  }, [fileOps, docs, activeId, activeDoc.content, rememberRecent]);

  // Close a tab, confirming first if it has unsaved changes.
  const requestCloseDoc = useCallback(
    (id: string) => {
      const doc = docs.docs.find((d) => d.id === id);
      if (!doc || !doc.isDirty) {
        docs.closeDoc(id);
        return;
      }
      const label = doc.filePath ? doc.filePath.split("/").pop() : "Untitled";
      setConfirm({
        title: "Unsaved changes",
        message: `"${label}" has unsaved changes. Save before closing?`,
        buttons: [
          {
            label: "Save",
            variant: "primary",
            onClick: async () => {
              setConfirm(null);
              const saved = await saveDoc(doc);
              if (saved) docs.closeDoc(id);
            },
          },
          {
            label: "Don't save",
            variant: "danger",
            onClick: () => {
              setConfirm(null);
              docs.closeDoc(id);
            },
          },
          { label: "Cancel", onClick: () => setConfirm(null) },
        ],
      });
    },
    [docs, saveDoc]
  );

  const handleExportSql = useCallback(
    async (dialect: string) => {
      try {
        const sql = await invoke<string>("generate_sql", {
          input: activeDoc.content,
          dialect,
        });
        await fileOps.exportSql(sql, dialect);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Export failed: ${msg}`);
      }
    },
    [fileOps, activeDoc.content]
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
      docs.replaceContent(activeId, dbml);
    },
    [docs, activeId]
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
    setRankdir((prev) => {
      const next = prev === "LR" ? "TB" : "LR";
      saveRankdir(next);
      return next;
    });
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
      const next = levels[(idx + 1) % levels.length];
      saveDetailLevel(next);
      return next;
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
        } else if (e.key === "t") {
          e.preventDefault();
          docs.newDoc(DEFAULT_CONTENT);
        } else if (e.key === "w") {
          e.preventDefault();
          requestCloseDoc(activeId);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpen, handleSave, handleSaveAs, requestCloseDoc, docs, activeId]);

  const toggleAutosave = useCallback(() => {
    setAutosave((prev) => {
      saveAutosave(!prev);
      return !prev;
    });
  }, []);

  // Autosave: debounced write of dirty, file-backed docs. "Untitled" buffers have
  // no path so they're covered by session persistence instead.
  const autosaveInFlight = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!autosave) return;
    const pending = docs.docs.filter(
      (d) => d.filePath && d.isDirty && !autosaveInFlight.current.has(d.id)
    );
    if (pending.length === 0) return;
    const t = setTimeout(async () => {
      setIsSaving(true);
      for (const d of pending) {
        autosaveInFlight.current.add(d.id);
        try {
          await fileOps.saveFile(d.content, d.filePath!);
          docs.markSaved(d.id, d.filePath!);
        } catch {
          // Ignore autosave failures; manual save still surfaces errors.
        } finally {
          autosaveInFlight.current.delete(d.id);
        }
      }
      setIsSaving(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [autosave, docs.docs, docs, fileOps]);

  // Persist the open tabs (debounced) so the session survives restarts.
  useEffect(() => {
    const t = setTimeout(() => saveSession(docs.docs, activeId), 500);
    return () => clearTimeout(t);
  }, [docs.docs, activeId]);

  // Latest docs / saveDoc for the once-registered window-close listener.
  const docsRef = useRef(docs.docs);
  const saveDocRef = useRef(saveDoc);
  useEffect(() => {
    docsRef.current = docs.docs;
    saveDocRef.current = saveDoc;
  }, [docs.docs, saveDoc]);

  // Intercept the app window close to confirm unsaved changes.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const win = getCurrentWindow();
    win
      .onCloseRequested((event) => {
        const dirty = docsRef.current.filter((d) => d.isDirty);
        if (dirty.length === 0) return; // nothing unsaved → allow close
        event.preventDefault();
        setConfirm({
          title: "Unsaved changes",
          message: `You have ${dirty.length} document(s) with unsaved changes.`,
          buttons: [
            {
              label: "Save all",
              variant: "primary",
              onClick: async () => {
                for (const d of dirty) {
                  const saved = await saveDocRef.current(d);
                  if (!saved) {
                    // A save dialog was cancelled → abort the close.
                    setConfirm(null);
                    return;
                  }
                }
                setConfirm(null);
                await win.destroy();
              },
            },
            {
              label: "Discard",
              variant: "danger",
              onClick: async () => {
                setConfirm(null);
                await win.destroy();
              },
            },
            { label: "Cancel", onClick: () => setConfirm(null) },
          ],
        });
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // On startup, hydrate restored clean docs by reading their files from disk.
  useEffect(() => {
    const restored = docs.docs.filter((d) => d.needsLoad && d.filePath);
    if (restored.length === 0) return;
    (async () => {
      for (const d of restored) {
        try {
          const c = await fileOps.readFile(d.filePath!);
          docs.hydrateDoc(d.id, c ?? "");
        } catch {
          docs.closeDoc(d.id);
          setRecentFiles(removeRecentFile(d.filePath!));
        }
      }
    })();
    // Run once on mount against the restored snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        filePath={activeDoc.filePath}
        isDirty={activeDoc.isDirty}
        recentFiles={recentFiles}
        autosave={autosave}
        isSaving={isSaving}
        onOpen={handleOpen}
        onOpenRecent={handleOpenRecent}
        onToggleAutosave={toggleAutosave}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportSql={handleExportSql}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onImportFile={handleImportFile}
        onPasteSql={() => setShowImportModal(true)}
      />
      <TabBar
        docs={docs.docs}
        activeId={activeId}
        onSelect={docs.setActive}
        onClose={requestCloseDoc}
        onNew={() => docs.newDoc(DEFAULT_CONTENT)}
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
            key={`${activeId}-${activeDoc.editorKey}`}
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
              storageKey={`${activeDoc.filePath ?? `untitled-${activeId}`}::${rankdir}`}
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
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          buttons={confirm.buttons}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

export default App;
