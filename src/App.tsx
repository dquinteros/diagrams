import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CodeEditor, type CodeEditorHandle } from "./components/Editor/CodeEditor";
import { languageExtensionsFor } from "./components/Editor/languages";
import { findTableAtOffset } from "./lib/findTableAtOffset";
import { utf16ToUtf8Offset, utf8ToUtf16Offset } from "./lib/textOffsets";
import { DiagramView } from "./components/DiagramView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { defaultContentFor, DIAGRAM_TYPES } from "./lib/diagramTypes";
import { parseSequence } from "./lib/sequence/parse";
import { layoutSequence } from "./lib/sequence/layout";
import { parseBpmn } from "./lib/bpmn/parse";
import { computeBpmnLayout } from "./lib/bpmn/canvasLayout";
import { parseArchitecture } from "./lib/architecture/parse";
import { computeArchitectureLayout } from "./lib/architecture/layout";
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

function App() {
  const { theme } = useTheme();
  const docs = useDocuments(defaultContentFor("dbml"));
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
  const editorRef = useRef<CodeEditorHandle>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only DBML uses the Rust parser; other types render client-side.
  const isDbml = activeDoc.type === "dbml";
  const { schema, parseError, isLoading } = useDbmlParser(isDbml ? content : "");
  // Kept current for the autocomplete extension, which reads it in an event
  // handler — update in an effect rather than during render (render must be pure).
  const schemaRef = useRef(schema);
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);
  const layout = useDiagramLayout(schema, rankdir, detailLevel);
  const fileOps = useFileOperations();
  const languageExtensions = useMemo(
    () => languageExtensionsFor(activeDoc.type, schemaRef),
    [activeDoc.type]
  );

  // Sequence diagrams parse + layout entirely client-side.
  const seq = useMemo(() => {
    if (activeDoc.type !== "sequence") return null;
    const { ir, error } = parseSequence(content);
    return { layout: layoutSequence(ir), error };
  }, [activeDoc.type, content]);

  // BPMN diagrams parse + layout entirely client-side (custom SVG renderer).
  const bpmn = useMemo(() => {
    if (activeDoc.type !== "bpmn") return null;
    const { ir, error } = parseBpmn(content);
    return { layout: computeBpmnLayout(ir), error };
  }, [activeDoc.type, content]);

  // Architecture diagrams parse + layout entirely client-side (custom SVG renderer).
  const arch = useMemo(() => {
    if (activeDoc.type !== "architecture") return null;
    const { ir, error } = parseArchitecture(content);
    return { layout: computeArchitectureLayout(ir), error };
  }, [activeDoc.type, content]);

  // Active diagram bounds (used by image export).
  const diagramW = isDbml ? layout.width : seq?.layout.width ?? bpmn?.layout.width ?? arch?.layout.width ?? 0;
  const diagramH = isDbml ? layout.height : seq?.layout.height ?? bpmn?.layout.height ?? arch?.layout.height ?? 0;

  // Unified parse-error for the toolbar across diagram types.
  const otherError = seq?.error ?? bpmn?.error ?? arch?.error ?? null;
  const activeError = isDbml
    ? parseError
    : otherError
      ? { message: otherError.message, span: null as [number, number] | null }
      : null;

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
        docs.markSaved(doc.id, saved, doc.content);
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
      docs.markSaved(activeId, saved, activeDoc.content);
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
      exportSvg(diagramW, diagramH);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Export failed: ${msg}`);
    }
  }, [diagramW, diagramH]);

  const handleExportPng = useCallback(async () => {
    try {
      await exportPng(diagramW, diagramH, theme.canvasBg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Export failed: ${msg}`);
    }
  }, [diagramW, diagramH, theme.canvasBg]);

  const handleExportPdf = useCallback(async () => {
    try {
      await exportPdf(diagramW, diagramH, theme.canvasBg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Export failed: ${msg}`);
    }
  }, [diagramW, diagramH, theme.canvasBg]);

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
        // CodeMirror reports UTF-16 offsets; parser spans are UTF-8 bytes.
        const tableName = findTableAtOffset(schema, utf16ToUtf8Offset(content, offset));
        setHighlightedTable(tableName);
      }, 100);
    },
    [schema, content]
  );

  const handleNavigateToSource = useCallback(
    (spanRange: [number, number]) => {
      // Parser spans are UTF-8 bytes; CodeMirror expects UTF-16 offsets.
      editorRef.current?.scrollToOffset(utf8ToUtf16Offset(content, spanRange[0]));
    },
    [content]
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
        // With Shift held, e.key for a letter is uppercase ("S"), so compare
        // case-insensitively — otherwise Cmd/Ctrl+Shift+S (Save As) never fires.
        const k = e.key.toLowerCase();
        if (k === "o") {
          e.preventDefault();
          handleOpen();
        } else if (k === "s" && e.shiftKey) {
          e.preventDefault();
          handleSaveAs();
        } else if (k === "s") {
          e.preventDefault();
          handleSave();
        } else if (k === "t") {
          e.preventDefault();
          docs.newDoc("dbml", defaultContentFor("dbml"));
        } else if (k === "w") {
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
          docs.markSaved(d.id, d.filePath!, d.content);
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
    // Tauri-only API; skip when running in a plain browser.
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
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
        // Registration resolves async: if the effect was cleaned up first,
        // unlisten immediately instead of leaking a duplicate handler.
        if (cancelled) fn();
        else unlisten = fn;
      });
    return () => {
      cancelled = true;
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

  // Track the divider drag on window so releasing the button outside the app
  // window still ends the drag.
  useEffect(() => {
    if (!isDraggingDivider) return;
    const handleMove = (e: MouseEvent) => {
      const pct = (e.clientX / window.innerWidth) * 100;
      setDividerPos(Math.max(15, Math.min(85, pct)));
    };
    const handleUp = () => setIsDraggingDivider(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingDivider]);

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
    >
      <Toolbar
        parseError={activeError}
        isLoading={isLoading}
        stats={
          isDbml && schema
            ? `${schema.tables.length} tables, ${schema.refs.length} refs`
            : activeDoc.type === "sequence" && seq
              ? `${seq.layout.participants.length} participants, ${seq.layout.messages.length} messages`
              : activeDoc.type === "bpmn" && bpmn
                ? `${bpmn.layout.nodes.length} nodes, ${bpmn.layout.edges.length} flows`
                : activeDoc.type === "architecture" && arch
                  ? `${arch.layout.nodes.length} nodes, ${arch.layout.edges.length} connections`
                  : DIAGRAM_TYPES[activeDoc.type].label
        }
        filePath={activeDoc.filePath}
        isDirty={activeDoc.isDirty}
        recentFiles={recentFiles}
        autosave={autosave}
        isSaving={isSaving}
        showSqlActions={isDbml}
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
        onNew={(type) => docs.newDoc(type, defaultContentFor(type))}
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
          <CodeEditor
            ref={editorRef}
            key={`${activeId}-${activeDoc.editorKey}`}
            initialValue={content}
            onChange={handleContentChange}
            onCursorChange={handleCursorChange}
            languageExtensions={languageExtensions}
            syncValue={content}
          />
        </div>
        {/* Signature: the panel divider is a precision tick-rule — the one
            control that adjusts the layout looks like a measuring instrument.
            Ticks are painted with a repeating gradient; a knurled grip sits at
            center and lights up in the accent while dragging. */}
        <div
          onMouseDown={handleDividerMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and canvas"
          style={{
            position: "relative",
            width: 9,
            backgroundColor: theme.toolbarBg,
            borderLeft: `1px solid ${theme.toolbarBorder}`,
            borderRight: `1px solid ${theme.toolbarBorder}`,
            cursor: "col-resize",
            flexShrink: 0,
            backgroundImage: `repeating-linear-gradient(to bottom, ${
              isDraggingDivider ? theme.dividerActive : theme.dividerHover
            } 0, ${isDraggingDivider ? theme.dividerActive : theme.dividerHover} 1px, transparent 1px, transparent 7px)`,
            backgroundPosition: "center",
            backgroundSize: "5px 100%",
            backgroundRepeat: "no-repeat",
            transition: isDraggingDivider ? "none" : "background-image 0.15s",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 5,
              height: 26,
              borderRadius: 3,
              backgroundColor: isDraggingDivider ? theme.dividerActive : theme.divider,
              boxShadow: `0 0 0 3px ${theme.toolbarBg}`,
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <ErrorBoundary key={`${activeId}-${activeDoc.type}`}>
          <DiagramView
            type={activeDoc.type}
            schema={schema}
            layout={layout}
            rankdir={rankdir}
            onToggleRankdir={toggleRankdir}
            detailLevel={detailLevel}
            onToggleDetailLevel={toggleDetailLevel}
            highlightedTable={highlightedTable}
            onNavigateToSource={handleNavigateToSource}
            storageKey={`${activeDoc.filePath ?? `untitled-${activeId}`}::${rankdir}`}
            seqLayout={seq?.layout ?? null}
            bpmnLayout={bpmn?.layout ?? null}
            archLayout={arch?.layout ?? null}
          />
          </ErrorBoundary>
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
