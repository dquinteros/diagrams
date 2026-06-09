import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { SchemaIR } from "../types/schema";
import type { LayoutResult, LayoutNode, LayoutEdge } from "../types/layout";
import { recomputeEdges } from "../lib/layoutEngine";

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
  schema: SchemaIR | null
): UseNodePositionsResult {
  const [overrides, setOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const prevLayoutRef = useRef<LayoutResult>(baseLayout);

  useEffect(() => {
    if (baseLayout !== prevLayoutRef.current) {
      prevLayoutRef.current = baseLayout;
    }
  }, [baseLayout]);

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

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, { x, y });
      return next;
    });
  }, []);

  const resetPositions = useCallback(() => {
    setOverrides(new Map());
  }, []);

  const startDrag = useCallback((id: string) => {
    setDragTarget(id);
  }, []);

  const endDrag = useCallback(() => {
    setDragTarget(null);
  }, []);

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
