import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../lib/tauri";
import type { SchemaIR, ParseError, ParseResult } from "../types/schema";

interface UseDbmlParserResult {
  schema: SchemaIR | null;
  parseError: ParseError | null;
  isLoading: boolean;
}

// Debounce bounds: small docs re-parse at 150ms; the delay grows with the
// measured parse duration (dbml-rs is superlinear: ~60ms at 300 tables,
// ~600ms at 1000) so huge docs don't queue a parse behind every keystroke.
const MIN_DEBOUNCE_MS = 150;
const MAX_DEBOUNCE_MS = 700;

export function useDbmlParser(content: string): UseDbmlParserResult {
  const [schema, setSchema] = useState<SchemaIR | null>(null);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id so a slow parse resolving late can't overwrite a newer result.
  const requestIdRef = useRef(0);
  const lastParseMsRef = useRef(0);
  // Last input → result. Covers remounts and tab switches where the content
  // did not change: no IPC round-trip, no redundant Rust parse.
  const cacheRef = useRef<{ input: string; result: ParseResult } | null>(null);

  const applyResult = useCallback((result: ParseResult) => {
    if (result.schema) {
      setSchema(result.schema);
      setParseError(null);
    } else if (result.error) {
      setParseError(result.error);
    }
  }, []);

  const parse = useCallback(async (input: string) => {
    const requestId = ++requestIdRef.current;

    // Nothing to parse: clear the canvas without a needless IPC round-trip.
    if (input.trim() === "") {
      setSchema(null);
      setParseError(null);
      setIsLoading(false);
      return;
    }

    // No desktop backend (plain browser): the Rust parser is unreachable, so
    // show a clear note instead of a cryptic "Cannot read … 'invoke'" error.
    if (!isTauri()) {
      setSchema(null);
      setParseError({
        message: "DBML preview runs in the desktop app.",
        span: null,
      });
      setIsLoading(false);
      return;
    }

    const cached = cacheRef.current;
    if (cached && cached.input === input) {
      applyResult(cached.result);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const t0 = performance.now();
      const result = await invoke<ParseResult>("parse_dbml", { input });
      lastParseMsRef.current = performance.now() - t0;
      if (requestId !== requestIdRef.current) return;
      cacheRef.current = { input, result };
      applyResult(result);
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
  }, [applyResult]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Adaptive delay: 1.5× the last measured parse, clamped.
    const delay = Math.min(
      MAX_DEBOUNCE_MS,
      Math.max(MIN_DEBOUNCE_MS, lastParseMsRef.current * 1.5)
    );
    timerRef.current = setTimeout(() => {
      parse(content);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, parse]);

  return { schema, parseError, isLoading };
}
