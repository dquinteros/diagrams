import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface FileResult {
  path: string;
  content: string;
}

interface UseFileOperationsResult {
  filePath: string | null;
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  openFile: () => Promise<{ content: string; path: string } | null>;
  saveFile: (content: string) => Promise<void>;
  saveFileAs: (content: string) => Promise<void>;
  exportSql: (sql: string, dialect: string) => Promise<void>;
}

export function useFileOperations(): UseFileOperationsResult {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isDirty, setDirty] = useState(false);

  const openFile = useCallback(async () => {
    try {
      const result = await invoke<FileResult | null>("open_file");
      if (result) {
        setFilePath(result.path);
        setDirty(false);
        return { content: result.content, path: result.path };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to open file: ${msg}`);
    }
    return null;
  }, []);

  const saveFile = useCallback(
    async (content: string) => {
      try {
        const result = await invoke<string | null>("save_file", {
          content,
          path: filePath,
        });
        if (result) {
          setFilePath(result);
          setDirty(false);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to save: ${msg}`);
      }
    },
    [filePath]
  );

  const saveFileAs = useCallback(async (content: string) => {
    try {
      const result = await invoke<string | null>("save_file", {
        content,
        path: null,
      });
      if (result) {
        setFilePath(result);
        setDirty(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to save: ${msg}`);
    }
  }, []);

  const exportSql = useCallback(async (sql: string, dialect: string) => {
    try {
      await invoke<string | null>("export_sql_file", { sql, dialect });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to export SQL: ${msg}`);
    }
  }, []);

  return {
    filePath,
    isDirty,
    setDirty,
    openFile,
    saveFile,
    saveFileAs,
    exportSql,
  };
}
