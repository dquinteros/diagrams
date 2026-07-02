import { useState, useCallback, useEffect, useRef } from "react";
import type { LayoutResult, LayoutNode } from "../types/layout";
import { loadTransform, saveTransform } from "../lib/layoutStorage";

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface UseViewTransformResult {
  transform: ViewTransform;
  setTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
  isPanning: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  zoomPercentage: number;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  panToNode: (node: LayoutNode) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function useViewTransform(
  layout: LayoutResult,
  storageKey: string
): UseViewTransformResult {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState<ViewTransform>(
    () => loadTransform(storageKey) ?? { x: 40, y: 40, scale: 1 }
  );
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const prevKeyRef = useRef<string>(storageKey);

  const zoomTo = useCallback((factor: number) => {
    setTransform((prev) => {
      const newScale = Math.max(0.1, Math.min(3.0, prev.scale * factor));
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, scale: newScale };
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return {
        x: cx - (cx - prev.x) * (newScale / prev.scale),
        y: cy - (cy - prev.y) * (newScale / prev.scale),
        scale: newScale,
      };
    });
  }, []);

  const zoomIn = useCallback(() => zoomTo(1.2), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(0.8), [zoomTo]);

  const fitToScreen = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    // Guard on the bounds, not node count: non-DBML canvases pass an empty
    // node map but still have real width/height.
    if (!rect || layout.width <= 0 || layout.height <= 0) return;

    const scale = Math.min(
      (rect.width - 80) / layout.width,
      (rect.height - 80) / layout.height,
      1.5
    ) * 0.9;

    setTransform({
      x: (rect.width - layout.width * scale) / 2,
      y: (rect.height - layout.height * scale) / 2,
      scale: Math.max(0.1, scale),
    });
  }, [layout]);

  const panToNode = useCallback((node: LayoutNode) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTransform((prev) => ({
      ...prev,
      x: rect.width / 2 - (node.x + node.width / 2) * prev.scale,
      y: rect.height / 2 - (node.y + node.height / 2) * prev.scale,
    }));
  }, []);

  // Zoom on wheel via a native non-passive listener: React 17+ attaches
  // `wheel` passively, so preventDefault inside an onWheel prop is a no-op.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((prev) => {
        const newScale = Math.max(0.1, Math.min(3.0, prev.scale * factor));
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        return {
          x: mx - (mx - prev.x) * (newScale / prev.scale),
          y: my - (my - prev.y) * (newScale / prev.scale),
          scale: newScale,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (
      e.target === svgRef.current ||
      (e.target as Element).classList.contains("canvas-bg")
    ) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }
  }, [transform.x, transform.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    }));
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Pending debounced camera save, flushed on tab switch and unmount so the
  // last pan/zoom isn't lost when its 400ms timer gets cleared.
  const pendingSaveRef = useRef<{ key: string; t: ViewTransform } | null>(null);

  // Restore persisted camera when the active file changes.
  useEffect(() => {
    if (storageKey !== prevKeyRef.current) {
      const pending = pendingSaveRef.current;
      if (pending && pending.key === prevKeyRef.current) {
        saveTransform(pending.key, pending.t);
        pendingSaveRef.current = null;
      }
      prevKeyRef.current = storageKey;
      setTransform(loadTransform(storageKey) ?? { x: 40, y: 40, scale: 1 });
    }
  }, [storageKey]);

  // Persist camera (debounced) so pan/zoom survives reloads.
  useEffect(() => {
    pendingSaveRef.current = { key: storageKey, t: transform };
    const timer = setTimeout(() => {
      saveTransform(storageKey, transform);
      pendingSaveRef.current = null;
    }, 400);
    return () => clearTimeout(timer);
  }, [transform, storageKey]);

  // Flush any pending save on unmount.
  useEffect(
    () => () => {
      const pending = pendingSaveRef.current;
      if (pending) saveTransform(pending.key, pending.t);
    },
    []
  );

  return {
    transform,
    setTransform,
    isPanning,
    zoomIn,
    zoomOut,
    fitToScreen,
    zoomPercentage: Math.round(transform.scale * 100),
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    panToNode,
    svgRef,
  };
}
