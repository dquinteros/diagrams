// Persist and restore the open-tabs session (localStorage).
//
// To avoid stale content for clean, file-backed documents, we store their
// `content` ONLY when it can't be recovered from disk — i.e. when the doc has
// unsaved changes or has no file path ("Untitled"). Clean docs are re-read from
// disk on restore.

import type { Doc } from "../hooks/useDocuments";

const SESSION_KEY = "diagrams-session";

export interface PersistedDoc {
  id: string;
  filePath: string | null;
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
  try {
    const payload: PersistedSession = {
      activeId,
      docs: docs.map((d) => ({
        id: d.id,
        filePath: d.filePath,
        isDirty: d.isDirty,
        // Keep content only when it cannot be re-read from disk.
        ...(d.isDirty || d.filePath == null ? { content: d.content } : {}),
      })),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be unavailable
  }
}
