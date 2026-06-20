// IR for the BPMN text DSL (compiled to BPMN 2.0 XML, then auto-laid-out).

export type BpmnNodeKind =
  | "start" // startEvent
  | "end" // endEvent
  | "task" // task
  | "user" // userTask
  | "service" // serviceTask
  | "script" // scriptTask
  | "xor" // exclusiveGateway
  | "and" // parallelGateway
  | "event"; // intermediateThrowEvent

export interface BpmnNode {
  id: string;
  kind: BpmnNodeKind;
  label: string;
  lane?: string; // lane name this node belongs to, if any
}

export interface BpmnFlow {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface BpmnIR {
  nodes: BpmnNode[];
  flows: BpmnFlow[];
  /** Lane names in declaration order (empty when no lanes are used). */
  lanes: string[];
}

export interface BpmnParseError {
  message: string;
  line: number;
}

export interface BpmnParseResult {
  ir: BpmnIR;
  error: BpmnParseError | null;
}

export const NODE_KINDS: BpmnNodeKind[] = [
  "start",
  "end",
  "task",
  "user",
  "service",
  "script",
  "xor",
  "and",
  "event",
];
