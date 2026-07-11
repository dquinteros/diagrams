// Persist and restore the open-tabs session (localStorage).
//
// To avoid stale content for clean, file-backed documents, we store their
// `content` ONLY when it can't be recovered from disk — i.e. when the doc has
// unsaved changes or has no file path ("Untitled"). Clean docs are re-read from
// disk on restore.

import type { Doc } from "../hooks/useDocuments";
import type { DiagramType } from "./diagramTypes";

const SESSION_KEY = "diagrams-session";

export interface PersistedDoc {
  id: string;
  filePath: string | null;
  type?: DiagramType;
  isDirty: boolean;
  content?: string;
}

export interface PersistedSession {
  activeId: string;
  docs: PersistedDoc[];
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed || !Array.isArray(parsed.docs) || typeof parsed.activeId !== "string") {
      return null;
    }
    const docs = parsed.docs.filter(
      (d): d is PersistedDoc => !!d && typeof d.id === "string"
    );
    if (docs.length === 0) return null;
    return { activeId: parsed.activeId, docs };
  } catch {
    return null;
  }
}

export function saveSession(docs: Doc[], activeId: string): void {
  const persisted: PersistedDoc[] = docs.map((d) => ({
    id: d.id,
    filePath: d.filePath,
    type: d.type,
    isDirty: d.isDirty,
    // Keep content only when it cannot be re-read from disk.
    ...(d.isDirty || d.filePath == null ? { content: d.content } : {}),
  }));

  const write = (payloadDocs: PersistedDoc[]): boolean => {
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ activeId, docs: payloadDocs })
      );
      return true;
    } catch {
      return false;
    }
  };

  if (write(persisted)) return;

  // The full payload didn't fit (likely a large scratch buffer over quota).
  // Rather than losing the whole session, drop inline content — file-backed
  // docs still restore from disk; unsaved buffers lose their text but the tab
  // itself survives.
  const reduced = persisted.map((d) =>
    d.content != null ? { ...d, content: "" } : d
  );
  write(reduced);
}
