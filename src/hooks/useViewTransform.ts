import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { LayoutResult, LayoutNode } from "../types/layout";
import { loadTransform, saveTransform } from "../lib/layoutStorage";

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

/** Read/subscribe interface for the live (per-frame) camera transform. */
export interface TransformStore {
  getTransform: () => ViewTransform;
  subscribe: (cb: (t: ViewTransform) => void) => () => void;
}

export interface SetTransformOptions {
  /**
   * When false the update is applied imperatively to the DOM (and announced to
   * subscribers) without committing to React state — used mid-gesture so a
   * pan/zoom frame never re-renders the canvas tree. Defaults to true.
   */
  commit?: boolean;
}

interface UseViewTransformResult extends TransformStore {
  /** Committed transform — updates at gesture end and on discrete actions. */
  transform: ViewTransform;
  setTransform: (
    action: React.SetStateAction<ViewTransform>,
    opts?: SetTransformOptions
  ) => void;
  /** Commit the current live transform to React state (ends a gesture). */
  commitTransform: () => void;
  store: TransformStore;
  isPanning: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  panToNode: (node: LayoutNode) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** Attach to the root <g>; the hook owns its `transform` attribute. */
  contentRef: React.RefObject<SVGGElement | null>;
}

const DEFAULT_TRANSFORM: ViewTransform = { x: 40, y: 40, scale: 1 };
// After the last wheel event, wait this long before committing the zoom.
const WHEEL_COMMIT_IDLE_MS = 150;

export function useViewTransform(
  layout: LayoutResult,
  storageKey: string
): UseViewTransformResult {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contentRef = useRef<SVGGElement | null>(null);

  const [committed, setCommitted] = useState<ViewTransform>(
    () => loadTransform(storageKey) ?? DEFAULT_TRANSFORM
  );
  // Live camera value, seeded from the initial committed state. Gestures
  // replace the object (immutable value, mutable ref) so subscribers can rely
  // on referential inequality.
  const liveRef = useRef<ViewTransform>(committed);

  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const prevKeyRef = useRef<string>(storageKey);
  const listenersRef = useRef<Set<(t: ViewTransform) => void>>(new Set());
  const rafRef = useRef<number | null>(null);
  const wheelIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writeAttr = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const t = liveRef.current;
    el.setAttribute("transform", `translate(${t.x}, ${t.y}) scale(${t.scale})`);
  }, []);

  // rAF-coalesced flush: one DOM write + one subscriber notification per frame
  // no matter how many mousemove/wheel events arrived in between.
  const flushFrame = useCallback(() => {
    rafRef.current = null;
    writeAttr();
    const t = liveRef.current;
    listenersRef.current.forEach((cb) => cb(t));
  }, [writeAttr]);

  const applyLive = useCallback(
    (next: ViewTransform) => {
      liveRef.current = next;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushFrame);
    },
    [flushFrame]
  );

  const commitTransform = useCallback(() => {
    setCommitted(liveRef.current);
  }, []);

  const setTransform = useCallback(
    (action: React.SetStateAction<ViewTransform>, opts?: SetTransformOptions) => {
      const next = typeof action === "function" ? action(liveRef.current) : action;
      applyLive(next);
      if (opts?.commit !== false) setCommitted(next);
    },
    [applyLive]
  );

  const getTransform = useCallback(() => liveRef.current, []);

  const subscribe = useCallback((cb: (t: ViewTransform) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const store = useMemo<TransformStore>(
    () => ({ getTransform, subscribe }),
    [getTransform, subscribe]
  );

  // React never renders the `transform` attribute; make sure the DOM matches
  // the live value after every render (mount, tab switch, hover re-renders).
  useLayoutEffect(() => {
    writeAttr();
  });

  const zoomTo = useCallback(
    (factor: number) => {
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
    },
    [setTransform]
  );

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
  }, [layout, setTransform]);

  const panToNode = useCallback(
    (node: LayoutNode) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTransform((prev) => ({
        ...prev,
        x: rect.width / 2 - (node.x + node.width / 2) * prev.scale,
        y: rect.height / 2 - (node.y + node.height / 2) * prev.scale,
      }));
    },
    [setTransform]
  );

  // Zoom on wheel via a native non-passive listener: React 17+ attaches
  // `wheel` passively, so preventDefault inside an onWheel prop is a no-op.
  // Frames are applied live; the zoom commits after a short idle.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const prev = liveRef.current;
      const newScale = Math.max(0.1, Math.min(3.0, prev.scale * factor));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      applyLive({
        x: mx - (mx - prev.x) * (newScale / prev.scale),
        y: my - (my - prev.y) * (newScale / prev.scale),
        scale: newScale,
      });
      if (wheelIdleRef.current) clearTimeout(wheelIdleRef.current);
      wheelIdleRef.current = setTimeout(() => {
        wheelIdleRef.current = null;
        commitTransform();
      }, WHEEL_COMMIT_IDLE_MS);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyLive, commitTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (
      e.target === svgRef.current ||
      (e.target as Element).classList.contains("canvas-bg")
    ) {
      isPanningRef.current = true;
      setIsPanning(true);
      const t = liveRef.current;
      panStartRef.current = { x: e.clientX - t.x, y: e.clientY - t.y };
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanningRef.current) return;
      applyLive({
        ...liveRef.current,
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    },
    [applyLive]
  );

  const handleMouseUp = useCallback(() => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    setIsPanning(false);
    commitTransform();
  }, [commitTransform]);

  // Restore persisted camera when the active file changes. The old tab's live
  // value (which may be ahead of the committed state mid-wheel) is saved first.
  useEffect(() => {
    if (storageKey !== prevKeyRef.current) {
      saveTransform(prevKeyRef.current, liveRef.current);
      prevKeyRef.current = storageKey;
      if (wheelIdleRef.current) {
        clearTimeout(wheelIdleRef.current);
        wheelIdleRef.current = null;
      }
      isPanningRef.current = false;
      setIsPanning(false);
      const next = loadTransform(storageKey) ?? DEFAULT_TRANSFORM;
      liveRef.current = next;
      writeAttr();
      setCommitted(next);
    }
  }, [storageKey, writeAttr]);

  // Persist camera (debounced) so pan/zoom survives reloads.
  useEffect(() => {
    const timer = setTimeout(() => {
      saveTransform(storageKey, committed);
    }, 400);
    return () => clearTimeout(timer);
  }, [committed, storageKey]);

  // On unmount: flush the live value (covers an uncommitted gesture and any
  // pending debounced save) and cancel scheduled work.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (wheelIdleRef.current) clearTimeout(wheelIdleRef.current);
      saveTransform(prevKeyRef.current, liveRef.current);
    },
    []
  );

  return {
    transform: committed,
    getTransform,
    subscribe,
    store,
    setTransform,
    commitTransform,
    isPanning,
    zoomIn,
    zoomOut,
    fitToScreen,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    panToNode,
    svgRef,
    contentRef,
  };
}
