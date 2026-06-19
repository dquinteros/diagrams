import type { BpmnIR, BpmnNodeKind } from "./types";

const TAG: Record<BpmnNodeKind, string> = {
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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build semantic BPMN 2.0 XML (no diagram interchange) from the IR. Flow nodes
 * include `<bpmn:incoming>`/`<bpmn:outgoing>` refs — required by the auto-layout.
 */
export function toSemanticXml(ir: BpmnIR): string {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const f of ir.flows) {
    (outgoing.get(f.from) ?? outgoing.set(f.from, []).get(f.from)!).push(f.id);
    (incoming.get(f.to) ?? incoming.set(f.to, []).get(f.to)!).push(f.id);
  }

  const elements = ir.nodes
    .map((n) => {
      const tag = TAG[n.kind];
      const ins = (incoming.get(n.id) ?? []).map((id) => `      <bpmn:incoming>${id}</bpmn:incoming>`);
      const outs = (outgoing.get(n.id) ?? []).map((id) => `      <bpmn:outgoing>${id}</bpmn:outgoing>`);
      const children = [...ins, ...outs].join("\n");
      const open = `    <bpmn:${tag} id="${esc(n.id)}" name="${esc(n.label)}">`;
      return children ? `${open}\n${children}\n    </bpmn:${tag}>` : `${open}</bpmn:${tag}>`;
    })
    .join("\n");

  const sequenceFlows = ir.flows
    .map((f) => {
      const name = f.label ? ` name="${esc(f.label)}"` : "";
      return `    <bpmn:sequenceFlow id="${esc(f.id)}" sourceRef="${esc(f.from)}" targetRef="${esc(f.to)}"${name} />`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
${elements}
${sequenceFlows}
  </bpmn:process>
</bpmn:definitions>`;
}
