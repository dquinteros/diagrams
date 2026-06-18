import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { SchemaIR } from "../types/schema";
import type { LayoutResult, LayoutNode, LayoutEdge } from "../types/layout";
import { recomputeEdges } from "../lib/layoutEngine";
import { loadPositions, savePositions } from "../lib/layoutStorage";

interface UseNodePositionsResult {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  moveNode: (id: string, x: number, y: number) => void;
  resetPositions: () => void;
  isDragging: boolean;
  startDrag: (id: string) => void;
  endDrag: () => void;
  dragTarget: string | null;
}

export function useNodePositions(
  baseLayout: LayoutResult,
  schema: SchemaIR | null,
  storageKey: string
): UseNodePositionsResult {
  const [overrides, setOverrides] = useState<Map<string, { x: number; y: number }>>(
    () => loadPositions(storageKey) ?? new Map()
  );
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const prevLayoutRef = useRef<LayoutResult>(baseLayout);
  const prevKeyRef = useRef<string>(storageKey);

  useEffect(() => {
    if (baseLayout !== prevLayoutRef.current) {
      prevLayoutRef.current = baseLayout;
    }
  }, [baseLayout]);

  // Load persisted positions when the active file changes.
  useEffect(() => {
    if (storageKey !== prevKeyRef.current) {
      prevKeyRef.current = storageKey;
      setOverrides(loadPositions(storageKey) ?? new Map());
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: Map<string, { x: number; y: number }>) => {
      savePositions(storageKey, next);
    },
    [storageKey]
  );

  const nodes = useMemo(() => {
    const result = new Map<string, LayoutNode>();
    for (const [id, node] of baseLayout.nodes) {
      const override = overrides.get(id);
      if (override) {
        result.set(id, { ...node, x: override.x, y: override.y });
      } else {
        result.set(id, node);
      }
    }
    return result;
  }, [baseLayout.nodes, overrides]);

  const edges = useMemo(() => {
    if (!schema || overrides.size === 0) return baseLayout.edges;
    return recomputeEdges(schema, nodes);
  }, [schema, nodes, baseLayout.edges, overrides.size]);

  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, { x, y });
      return next;
    });
  }, []);

  const resetPositions = useCallback(() => {
    setOverrides(new Map());
    persist(new Map());
  }, [persist]);

  const startDrag = useCallback((id: string) => {
    setDragTarget(id);
  }, []);

  const endDrag = useCallback(() => {
    setDragTarget(null);
    persist(overridesRef.current);
  }, [persist]);

  return {
    nodes,
    edges,
    moveNode,
    resetPositions,
    isDragging: dragTarget !== null,
    startDrag,
    endDrag,
    dragTarget,
  };
}
