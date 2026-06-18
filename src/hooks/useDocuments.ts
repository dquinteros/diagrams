import { useState, useCallback, useRef } from "react";

export interface Doc {
  id: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
  editorKey: number;
}

export interface UseDocumentsResult {
  docs: Doc[];
  activeId: string;
  activeDoc: Doc;
  newDoc: (content?: string) => void;
  openDoc: (filePath: string, content: string) => void;
  closeDoc: (id: string) => void;
  setActive: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  replaceContent: (id: string, content: string) => void;
  markSaved: (id: string, filePath: string) => void;
}

export function useDocuments(initialContent: string): UseDocumentsResult {
  const counterRef = useRef(1);
  const makeId = () => `doc-${counterRef.current++}`;

  const [docs, setDocs] = useState<Doc[]>(() => [
    {
      id: "doc-0",
      filePath: null,
      content: initialContent,
      isDirty: false,
      editorKey: 0,
    },
  ]);
  const [activeId, setActiveId] = useState("doc-0");

  const activeDoc = docs.find((d) => d.id === activeId) ?? docs[0];

  const newDoc = useCallback((content = "") => {
    const id = makeId();
    setDocs((prev) => [
      ...prev,
      { id, filePath: null, content, isDirty: false, editorKey: 0 },
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
        { id, filePath, content, isDirty: false, editorKey: 0 },
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
  };
}
