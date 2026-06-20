import {
  type BpmnNode,
  type BpmnNodeKind,
  type BpmnFlow,
  type BpmnParseResult,
  NODE_KINDS,
} from "./types";

const KIND_SET = new Set<string>(NODE_KINDS);

const NODE_RE = /^([a-z]+)\s+([A-Za-z_][\w-]*)\s*(.*)$/i;
const FLOW_RE = /^([A-Za-z_][\w-]*)\s*->\s*([A-Za-z_][\w-]*)\s*(?::\s*(.+))?$/;

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Parse the BPMN DSL into an IR (TS-only, no XML). */
export function parseBpmn(input: string): BpmnParseResult {
  const nodes: BpmnNode[] = [];
  const byId = new Map<string, BpmnNode>();
  const flows: BpmnFlow[] = [];
  const lanes: string[] = [];
  let currentLane: string | undefined;
  let error: BpmnParseResult["error"] = null;
  let flowSeq = 0;

  const ensureNode = (id: string, kind: BpmnNodeKind = "task", label?: string) => {
    const existing = byId.get(id);
    if (existing) return existing;
    const node: BpmnNode = { id, kind, label: label ?? id, lane: currentLane };
    byId.set(id, node);
    nodes.push(node);
    return node;
  };

  const lines = input.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    // Lane block: `lane "Name"` — subsequent nodes belong to it.
    const laneMatch = /^lane\s+(.+)$/i.exec(line);
    if (laneMatch) {
      const name = unquote(laneMatch[1]);
      currentLane = name;
      if (!lanes.includes(name)) lanes.push(name);
      continue;
    }

    // Flow: a -> b [: "label"]
    const flow = FLOW_RE.exec(line);
    if (flow) {
      const [, from, to, rawLabel] = flow;
      ensureNode(from);
      ensureNode(to);
      flows.push({
        id: `flow_${++flowSeq}`,
        from,
        to,
        label: rawLabel ? unquote(rawLabel) : undefined,
      });
      continue;
    }

    // Node: <kind> <id> "label"
    const node = NODE_RE.exec(line);
    if (node) {
      const kind = node[1].toLowerCase();
      if (KIND_SET.has(kind)) {
        const id = node[2];
        const label = node[3] ? unquote(node[3]) : id;
        const existing = byId.get(id);
        if (existing) {
          existing.kind = kind as BpmnNodeKind;
          existing.label = label;
          existing.lane = currentLane;
        } else {
          ensureNode(id, kind as BpmnNodeKind, label);
        }
        continue;
      }
    }

    if (!error) {
      error = { message: `Unrecognized line: "${line}"`, line: i + 1 };
    }
  }

  return { ir: { nodes, flows, lanes }, error };
}
