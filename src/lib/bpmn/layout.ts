import { layoutProcess } from "bpmn-auto-layout";
import { parseBpmn } from "./parse";
import { toSemanticXml } from "./toXml";
import { buildLaneXml } from "./laneLayout";

export interface BpmnCompileResult {
  xml: string | null;
  error: string | null;
}

/**
 * DSL → BPMN XML with diagram interchange.
 * - With lanes: we compute the pool/lane geometry ourselves (auto-layout ignores
 *   lanes).
 * - Without lanes: `bpmn-auto-layout` positions nodes/edges.
 */
export async function compileBpmn(dsl: string): Promise<BpmnCompileResult> {
  const { ir, error } = parseBpmn(dsl);
  if (error) {
    return { xml: null, error: `Line ${error.line}: ${error.message}` };
  }
  if (ir.nodes.length === 0) {
    return { xml: null, error: null };
  }
  try {
    if (ir.lanes.length > 0) {
      return { xml: buildLaneXml(ir), error: null };
    }
    const xml = await layoutProcess(toSemanticXml(ir));
    return { xml, error: null };
  } catch (e: unknown) {
    return { xml: null, error: e instanceof Error ? e.message : "Layout failed" };
  }
}
