import {
  type ArchNode,
  type ArchNodeKind,
  type ArchEdge,
  type ArchParseResult,
  resolveKind,
} from "./types";

// `<kind> <id> ["label"]`
const NODE_RE = /^([A-Za-z_][\w-]*)\s+([A-Za-z_][\w-]*)\s*(.*)$/;
// `<from> -> <to> [: "label"]` with an optional trailing `~` (async).
const FLOW_RE = /^([A-Za-z_][\w-]*)\s*->\s*([A-Za-z_][\w-]*)\s*(?::\s*(.+?))?\s*(~)?\s*$/;

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Parse the Architecture DSL into an IR (TS-only). */
export function parseArchitecture(input: string): ArchParseResult {
  const nodes: ArchNode[] = [];
  const byId = new Map<string, ArchNode>();
  const edges: ArchEdge[] = [];
  const groups: string[] = [];
  let currentGroup: string | undefined;
  let error: ArchParseResult["error"] = null;
  let edgeSeq = 0;

  const ensureNode = (
    id: string,
    kind: ArchNodeKind = "component",
    label?: string,
    group: string | undefined = currentGroup
  ) => {
    const existing = byId.get(id);
    if (existing) return existing;
    const node: ArchNode = { id, kind, label: label ?? id, group };
    byId.set(id, node);
    nodes.push(node);
    return node;
  };

  const lines = input.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    // Group block: `group "Name"` … `end`. Nodes declared in between join it.
    const groupMatch = /^group\s+(.+)$/i.exec(line);
    if (groupMatch) {
      const name = unquote(groupMatch[1]);
      currentGroup = name;
      if (!groups.includes(name)) groups.push(name);
      continue;
    }
    if (/^end$/i.test(line)) {
      currentGroup = undefined;
      continue;
    }

    // Flow: a -> b [: "label"] [~]
    const flow = FLOW_RE.exec(line);
    if (flow) {
      const [, from, to, rawLabel, asyncMark] = flow;
      // Flow endpoints are not group members unless explicitly declared inside
      // the group — pass group: undefined so they don't inherit currentGroup.
      ensureNode(from, "component", undefined, undefined);
      ensureNode(to, "component", undefined, undefined);
      edges.push({
        id: `edge_${++edgeSeq}`,
        from,
        to,
        label: rawLabel ? unquote(rawLabel) : undefined,
        async: !!asyncMark,
      });
      continue;
    }

    // Node: <kind> <id> "label"
    const node = NODE_RE.exec(line);
    if (node) {
      const kind = resolveKind(node[1]);
      if (kind) {
        const id = node[2];
        const label = node[3] ? unquote(node[3]) : id;
        const existing = byId.get(id);
        if (existing) {
          existing.kind = kind;
          existing.label = label;
          existing.group = currentGroup;
        } else {
          ensureNode(id, kind, label);
        }
        continue;
      }
    }

    if (!error) {
      error = { message: `Unrecognized line: "${line}"`, line: i + 1 };
    }
  }

  return { ir: { nodes, edges, groups }, error };
}
