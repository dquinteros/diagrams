import type { BpmnIR, BpmnNodeKind } from "./types";

export const TAG: Record<BpmnNodeKind, string> = {
  start: "startEvent",
  end: "endEvent",
  task: "task",
  user: "userTask",
  service: "serviceTask",
  script: "scriptTask",
  xor: "exclusiveGateway",
  and: "parallelGateway",
  event: "intermediateThrowEvent",
};

export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Flow-node elements with `<bpmn:incoming>`/`<bpmn:outgoing>` refs. */
export function flowNodesXml(ir: BpmnIR): string {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const f of ir.flows) {
    (outgoing.get(f.from) ?? outgoing.set(f.from, []).get(f.from)!).push(f.id);
    (incoming.get(f.to) ?? incoming.set(f.to, []).get(f.to)!).push(f.id);
  }
  return ir.nodes
    .map((n) => {
      const tag = TAG[n.kind];
      const ins = (incoming.get(n.id) ?? []).map((id) => `      <bpmn:incoming>${id}</bpmn:incoming>`);
      const outs = (outgoing.get(n.id) ?? []).map((id) => `      <bpmn:outgoing>${id}</bpmn:outgoing>`);
      const children = [...ins, ...outs].join("\n");
      const open = `    <bpmn:${tag} id="${escXml(n.id)}" name="${escXml(n.label)}">`;
      return children ? `${open}\n${children}\n    </bpmn:${tag}>` : `${open}</bpmn:${tag}>`;
    })
    .join("\n");
}

export function sequenceFlowsXml(ir: BpmnIR): string {
  return ir.flows
    .map((f) => {
      const name = f.label ? ` name="${escXml(f.label)}"` : "";
      return `    <bpmn:sequenceFlow id="${escXml(f.id)}" sourceRef="${escXml(f.from)}" targetRef="${escXml(f.to)}"${name} />`;
    })
    .join("\n");
}

/**
 * Build semantic BPMN 2.0 XML (no diagram interchange) from the IR — used for the
 * lane-less path where `bpmn-auto-layout` computes positions.
 */
export function toSemanticXml(ir: BpmnIR): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
${flowNodesXml(ir)}
${sequenceFlowsXml(ir)}
  </bpmn:process>
</bpmn:definitions>`;
}
