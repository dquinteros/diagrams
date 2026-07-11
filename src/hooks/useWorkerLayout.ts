import { useEffect, useRef, useState } from "react";
import {
  computeLayoutJob,
  type LayoutJob,
  type LayoutJobResult,
  type LayoutRequest,
  type LayoutResponse,
} from "../workers/layoutWorker";

// A layout stuck longer than this when a newer request arrives gets its
// worker terminated and respawned (dagre is not interruptible).
const STUCK_TERMINATE_MS = 500;

interface WorkerLayoutState {
  layout: LayoutJobResult | null;
  isLayouting: boolean;
}

interface LayoutOutcome {
  layout: LayoutJobResult | null;
  /** The job this outcome answers — isLayouting derives from comparing it
   *  with the current job, so effects never set state synchronously. */
  forJob: LayoutJob;
}

/**
 * Run dagre layouts (DBML / Architecture) in a web worker.
 * - Last request wins: stale responses are dropped by id.
 * - The previous layout stays visible while a new one computes (no flicker).
 * - Falls back to synchronous main-thread layout if workers are unavailable
 *   or the worker fails (workers get a smaller call stack than the page and
 *   dagre recurses deeply on long chains).
 */
export function useWorkerLayout(job: LayoutJob | null): WorkerLayoutState {
  const [outcome, setOutcome] = useState<LayoutOutcome | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerBrokenRef = useRef(false);
  const lastIdRef = useRef(0);
  const busySinceRef = useRef<number | null>(null);
  // Current job, readable from the worker onmessage handler (created once).
  const currentJobRef = useRef<LayoutJob | null>(null);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!job) {
      // Invalidate in-flight responses so a late result can't resurrect a
      // cleared diagram; the null case itself derives at the return value.
      ++lastIdRef.current;
      return;
    }

    const id = ++lastIdRef.current;
    currentJobRef.current = job;

    const settle = (layout: LayoutJobResult | null) => {
      if (id !== lastIdRef.current) return; // superseded
      busySinceRef.current = null;
      setOutcome((prev) => ({ layout: layout ?? prev?.layout ?? null, forJob: job }));
    };

    const runSync = () => {
      try {
        settle(computeLayoutJob(job));
      } catch {
        // Malformed input mid-edit: keep the previous layout on screen.
        settle(null);
      }
    };

    if (workerBrokenRef.current) {
      runSync();
      return;
    }

    // dagre can't be cancelled: if the worker has been grinding for a while,
    // replace it so this newer request doesn't queue behind a huge stale one.
    if (
      workerRef.current &&
      busySinceRef.current !== null &&
      Date.now() - busySinceRef.current > STUCK_TERMINATE_MS
    ) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    try {
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL("../workers/layoutWorker.ts", import.meta.url),
          { type: "module" }
        );
        workerRef.current.onmessage = (e: MessageEvent<LayoutResponse>) => {
          const res = e.data;
          if (res.id !== lastIdRef.current) return;
          busySinceRef.current = null;
          const current = currentJobRef.current;
          if (res.ok) {
            setOutcome({ layout: res.layout, forJob: current! });
            return;
          }
          // Retry synchronously on the main thread (bigger call stack).
          try {
            if (!current) throw new Error(res.error);
            setOutcome({ layout: computeLayoutJob(current), forJob: current });
          } catch {
            setOutcome((prev) => ({ layout: prev?.layout ?? null, forJob: current! }));
          }
        };
        workerRef.current.onerror = () => {
          // Worker unavailable (or crashed loading): permanent sync fallback.
          workerBrokenRef.current = true;
          workerRef.current?.terminate();
          workerRef.current = null;
          runSync();
        };
      }
      busySinceRef.current = Date.now();
      const request: LayoutRequest = { id, job };
      workerRef.current.postMessage(request);
    } catch {
      workerBrokenRef.current = true;
      runSync();
    }
  }, [job]);

  if (!job) return { layout: null, isLayouting: false };
  return {
    layout: outcome?.layout ?? null,
    isLayouting: outcome?.forJob !== job,
  };
}
