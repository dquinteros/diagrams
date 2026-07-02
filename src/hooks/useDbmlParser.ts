import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SchemaIR, ParseError, ParseResult } from "../types/schema";

interface UseDbmlParserResult {
  schema: SchemaIR | null;
  parseError: ParseError | null;
  isLoading: boolean;
}

export function useDbmlParser(content: string): UseDbmlParserResult {
  const [schema, setSchema] = useState<SchemaIR | null>(null);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id so a slow parse resolving late can't overwrite a newer result.
  const requestIdRef = useRef(0);

  const parse = useCallback(async (input: string) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const result = await invoke<ParseResult>("parse_dbml", { input });
      if (requestId !== requestIdRef.current) return;
      if (result.schema) {
        setSchema(result.schema);
        setParseError(null);
      } else if (result.error) {
        setParseError(result.error);
      }
    } catch (e: unknown) {
      if (requestId !== requestIdRef.current) return;
      const message = e instanceof Error ? e.message : String(e);
      setParseError({
        message: `IPC error: ${message}`,
        span: null,
      });
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      parse(content);
    }, 150);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, parse]);

  return { schema, parseError, isLoading };
}
