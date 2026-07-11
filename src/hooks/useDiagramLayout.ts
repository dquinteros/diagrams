import { useMemo } from "react";
import type { SchemaIR } from "../types/schema";
import type { LayoutResult, DetailLevel } from "../types/layout";
import { useWorkerLayout } from "./useWorkerLayout";
import type { LayoutJob } from "../workers/layoutWorker";

const EMPTY_LAYOUT: LayoutResult = {
  nodes: new Map(),
  edges: [],
  width: 0,
  height: 0,
};

interface UseDiagramLayoutResult {
  layout: LayoutResult;
  /** True while the worker recomputes; the previous layout stays on screen. */
  isLayouting: boolean;
}

export function useDiagramLayout(
  schema: SchemaIR | null,
  rankdir: "LR" | "TB" = "LR",
  detailLevel: DetailLevel = "full"
): UseDiagramLayoutResult {
  const job = useMemo<LayoutJob | null>(() => {
    if (!schema) return null;
    const isEmpty =
      schema.tables.length === 0 &&
      schema.enums.length === 0 &&
      schema.notes.length === 0;
    if (isEmpty) return null;
    return { kind: "dbml", schema, options: { rankdir, detailLevel } };
  }, [schema, rankdir, detailLevel]);

  const { layout, isLayouting } = useWorkerLayout(job);
  return { layout: (layout as LayoutResult | null) ?? EMPTY_LAYOUT, isLayouting };
}
