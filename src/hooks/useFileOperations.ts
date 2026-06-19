import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface FileResult {
  path: string;
  content: string;
}

interface UseFileOperationsResult {
  openFile: () => Promise<{ content: string; path: string } | null>;
  readFile: (path: string) => Promise<string | null>;
  openSqlFile: () => Promise<string | null>;
  saveFile: (content: string, path: string | null) => Promise<string | null>;
  exportSql: (sql: string, dialect: string) => Promise<void>;
  importSql: (sql: string, dialect: string) => Promise<string>;
}

export function useFileOperations(): UseFileOperationsResult {
  const openFile = useCallback(async () => {
    try {
      const result = await invoke<FileResult | null>("open_file");
      return result ? { content: result.content, path: result.path } : null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to open file: ${msg}`, { cause: e });
    }
  }, []);

  const readFile = useCallback(async (path: string) => {
    try {
      return await invoke<string>("read_file", { path });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to read file: ${msg}`, { cause: e });
    }
  }, []);

  const saveFile = useCallback(async (content: string, path: string | null) => {
    try {
      return await invoke<string | null>("save_file", { content, path });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to save: ${msg}`, { cause: e });
    }
  }, []);

  const openSqlFile = useCallback(async () => {
    try {
      const result = await invoke<FileResult | null>("open_sql_file");
      return result ? result.content : null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to open SQL file: ${msg}`, { cause: e });
    }
  }, []);

  const exportSql = useCallback(async (sql: string, dialect: string) => {
    try {
      await invoke<string | null>("export_sql_file", { sql, dialect });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to export SQL: ${msg}`, { cause: e });
    }
  }, []);

  const importSql = useCallback(async (sql: string, dialect: string) => {
    try {
      return await invoke<string>("import_sql", { input: sql, dialect });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to import SQL: ${msg}`, { cause: e });
    }
  }, []);

  return { openFile, readFile, openSqlFile, saveFile, exportSql, importSql };
}
