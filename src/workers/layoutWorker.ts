// Web worker for the two dagre-based layouts (DBML tables and Architecture),
// which block the main thread for hundreds of ms at hundreds of nodes.
// The message handler is a thin wrapper over `handleLayoutRequest` so the
// protocol is unit-testable without spawning a real Worker.

import { computeLayout, type LayoutOptions } from "../lib/layoutEngine";
import { computeArchitectureLayout, type ArchCanvasLayout } from "../lib/architecture/layout";
import type { ArchIR } from "../lib/architecture/types";
import type { SchemaIR } from "../types/schema";
import type { LayoutResult } from "../types/layout";

export type LayoutJob =
  | { kind: "dbml"; schema: SchemaIR; options: LayoutOptions }
  | { kind: "arch"; ir: ArchIR };

export type LayoutJobResult = LayoutResult | ArchCanvasLayout;

export interface LayoutRequest {
  id: number;
  job: LayoutJob;
}

export type LayoutResponse =
  | { id: number; ok: true; layout: LayoutJobResult }
  | { id: number; ok: false; error: string };

export function computeLayoutJob(job: LayoutJob): LayoutJobResult {
  return job.kind === "dbml"
    ? computeLayout(job.schema, job.options)
    : computeArchitectureLayout(job.ir);
}

export function handleLayoutRequest(req: LayoutRequest): LayoutResponse {
  try {
    return { id: req.id, ok: true, layout: computeLayoutJob(req.job) };
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Only bind when actually running inside a worker (not when imported by
// tests or by the main-thread fallback path).
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.onmessage = (e: MessageEvent<LayoutRequest>) => {
    // LayoutResult.nodes is a Map — covered by the structured clone algorithm.
    self.postMessage(handleLayoutRequest(e.data));
  };
}
