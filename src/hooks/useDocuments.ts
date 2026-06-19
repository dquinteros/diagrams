import { useState, useCallback, useRef } from "react";
import { loadSession } from "../lib/session";
import { type DiagramType, detectType } from "../lib/diagramTypes";

export interface Doc {
  id: string;
  filePath: string | null;
  content: string;
  type: DiagramType;
  isDirty: boolean;
  editorKey: number;
  // Restored clean doc whose content must still be read from disk.
  needsLoad?: boolean;
}

export interface UseDocumentsResult {
  docs: Doc[];
  activeId: string;
  activeDoc: Doc;
  newDoc: (type: DiagramType, content: string) => void;
  openDoc: (filePath: string, content: string) => void;
  closeDoc: (id: string) => void;
  setActive: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  replaceContent: (id: string, content: string) => void;
  markSaved: (id: string, filePath: string) => void;
  hydrateDoc: (id: string, content: string) => void;
}

function bootstrap(initialContent: string): { docs: Doc[]; activeId: string } {
  const session = loadSession();
  if (session) {
    const docs: Doc[] = session.docs.map((pd) => ({
      id: pd.id,
      filePath: pd.filePath,
      content: pd.content ?? "",
      type: pd.type ?? detectType(pd.filePath, pd.content ?? ""),
      isDirty: pd.isDirty,
      editorKey: 0,
      // Clean, file-backed docs were saved without content → load from disk.
      needsLoad: pd.content === undefined && pd.filePath != null,
    }));
    const activeId = docs.some((d) => d.id === session.activeId)
      ? session.activeId
      : docs[0].id;
    return { docs, activeId };
  }
  return {
    docs: [
      { id: "doc-0", filePath: null, content: initialContent, type: "dbml", isDirty: false, editorKey: 0 },
    ],
    activeId: "doc-0",
  };
}

function nextCounter(docs: Doc[]): number {
  let max = 0;
  for (const d of docs) {
    const m = /^doc-(\d+)$/.exec(d.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function useDocuments(initialContent: string): UseDocumentsResult {
  const initial = useRef(bootstrap(initialContent));
  const counterRef = useRef(nextCounter(initial.current.docs));
  const makeId = () => `doc-${counterRef.current++}`;

  const [docs, setDocs] = useState<Doc[]>(initial.current.docs);
  const [activeId, setActiveId] = useState(initial.current.activeId);

  const activeDoc = docs.find((d) => d.id === activeId) ?? docs[0];

  const newDoc = useCallback((type: DiagramType, content: string) => {
    const id = makeId();
    setDocs((prev) => [
      ...prev,
      { id, filePath: null, content, type, isDirty: false, editorKey: 0 },
    ]);
    setActiveId(id);
  }, []);

  const openDoc = useCallback((filePath: string, content: string) => {
    setDocs((prev) => {
      const existing = prev.find((d) => d.filePath === filePath);
      if (existing) {
        setActiveId(existing.id);
        return prev;
      }
      const id = makeId();
      setActiveId(id);
      return [
        ...prev,
        {
          id,
          filePath,
          content,
          type: detectType(filePath, content),
          isDirty: false,
          editorKey: 0,
        },
      ];
    });
  }, []);

  const closeDoc = useCallback((id: string) => {
    setDocs((prev) => {
      if (prev.length === 1) {
        // Keep at least one document: reset the last one to an empty buffer.
        const fresh: Doc = {
          id: "doc-0",
          filePath: null,
          content: "",
          type: "dbml",
          isDirty: false,
          editorKey: prev[0].editorKey + 1,
        };
        setActiveId(fresh.id);
        return [fresh];
      }
      const idx = prev.findIndex((d) => d.id === id);
      const next = prev.filter((d) => d.id !== id);
      setActiveId((current) => {
        if (current !== id) return current;
        const fallback = next[Math.max(0, idx - 1)] ?? next[0];
        return fallback.id;
      });
      return next;
    });
  }, []);

  const setActive = useCallback((id: string) => setActiveId(id), []);

  const updateContent = useCallback((id: string, content: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, content, isDirty: true } : d))
    );
  }, []);

  // Replace content without preserving editor state (e.g. import/open into the
  // active buffer): bumps editorKey to remount the editor.
  const replaceContent = useCallback((id: string, content: string) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, content, isDirty: true, editorKey: d.editorKey + 1 }
          : d
      )
    );
  }, []);

  const markSaved = useCallback((id: string, filePath: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, filePath, isDirty: false } : d))
    );
  }, []);

  // Fill in a restored doc's content read from disk (keeps it clean).
  const hydrateDoc = useCallback((id: string, content: string) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, content, isDirty: false, needsLoad: false, editorKey: d.editorKey + 1 }
          : d
      )
    );
  }, []);

  return {
    docs,
    activeId,
    activeDoc,
    newDoc,
    openDoc,
    closeDoc,
    setActive,
    updateContent,
    replaceContent,
    markSaved,
    hydrateDoc,
  };
}
