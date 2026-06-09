import { useMemo } from "react";
import type { SchemaIR } from "../types/schema";
import type { LayoutResult } from "../types/layout";
import { computeLayout } from "../lib/layoutEngine";

const EMPTY_LAYOUT: LayoutResult = {
  nodes: new Map(),
  edges: [],
  width: 0,
  height: 0,
};

export function useDiagramLayout(
  schema: SchemaIR | null,
  rankdir: "LR" | "TB" = "LR"
): LayoutResult {
  return useMemo(() => {
    if (!schema || schema.tables.length === 0) return EMPTY_LAYOUT;
    return computeLayout(schema, { rankdir });
  }, [schema, rankdir]);
}
