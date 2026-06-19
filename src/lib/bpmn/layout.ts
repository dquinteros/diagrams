import { layoutProcess } from "bpmn-auto-layout";
import { parseBpmn } from "./parse";
import { toSemanticXml } from "./toXml";

export interface BpmnCompileResult {
  xml: string | null;
  error: string | null;
}

/** DSL → semantic BPMN XML → auto-laid-out BPMN XML (with diagram interchange). */
export async function compileBpmn(dsl: string): Promise<BpmnCompileResult> {
  const { ir, error } = parseBpmn(dsl);
  if (error) {
    return { xml: null, error: `Line ${error.line}: ${error.message}` };
  }
  if (ir.nodes.length === 0) {
    return { xml: null, error: null };
  }
  const semantic = toSemanticXml(ir);
  try {
    const xml = await layoutProcess(semantic);
    return { xml, error: null };
  } catch (e: unknown) {
    return { xml: null, error: e instanceof Error ? e.message : "Layout failed" };
  }
}
