import dagre from "@dagrejs/dagre";
import type { ArchIR } from "./types";
import type { Pt } from "../edgePath";

// Pure geometry for the Architecture renderer. Uses dagre with compound
// (cluster) nodes so grouped components stay enclosed in their zone band.

const NODE_W = 160;
const NODE_H = 72;
const NODE_SEP = 70;
const RANK_SEP = 90;
const MARGIN = 40;

// Padding of a group band around its members, plus headroom for the title.
const GROUP_PAD = 18;
const GROUP_TITLE_H = 22;

export interface ArchPlacedNode {
  id: string;
  kind: ArchIR["nodes"][number]["kind"];
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface ArchPlacedEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  async?: boolean;
  points: Pt[];
}

export interface ArchGroupBand {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArchCanvasLayout {
  groups: ArchGroupBand[];
  nodes: ArchPlacedNode[];
  edges: ArchPlacedEdge[];
  width: number;
  height: number;
}

const groupNodeId = (name: string) => `grp::${name}`;

export function computeArchitectureLayout(ir: ArchIR): ArchCanvasLayout {
  const useGroups = ir.groups.length > 0;
  const g = new dagre.graphlib.Graph({ compound: useGroups });
  g.setGraph({
    rankdir: "LR",
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    marginx: MARGIN,
    marginy: MARGIN,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Cluster nodes for each group, then the component nodes (parented if grouped).
  if (useGroups) {
    for (const name of ir.groups) {
      g.setNode(groupNodeId(name), { label: name });
    }
  }
  for (const n of ir.nodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
    if (useGroups && n.group && ir.groups.includes(n.group)) {
      g.setParent(n.id, groupNodeId(n.group));
    }
  }
  for (const e of ir.edges) {
    if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to);
  }

  dagre.layout(g);

  const placed = new Map<string, ArchPlacedNode>();
  for (const n of ir.nodes) {
    const dn = g.node(n.id);
    if (!dn) continue;
    const x = dn.x - dn.width / 2;
    const y = dn.y - dn.height / 2;
    placed.set(n.id, {
      id: n.id,
      kind: n.kind,
      label: n.label,
      x,
      y,
      w: dn.width,
      h: dn.height,
      cx: dn.x,
      cy: dn.y,
    });
  }

  // Group bands: bounding box of members, padded, with title headroom on top.
  const groups: ArchGroupBand[] = [];
  if (useGroups) {
    for (const name of ir.groups) {
      const members = ir.nodes.filter((n) => n.group === name).map((n) => placed.get(n.id)!).filter(Boolean);
      if (members.length === 0) continue;
      const minX = Math.min(...members.map((m) => m.x));
      const minY = Math.min(...members.map((m) => m.y));
      const maxX = Math.max(...members.map((m) => m.x + m.w));
      const maxY = Math.max(...members.map((m) => m.y + m.h));
      groups.push({
        name,
        x: minX - GROUP_PAD,
        y: minY - GROUP_PAD - GROUP_TITLE_H,
        w: maxX - minX + GROUP_PAD * 2,
        h: maxY - minY + GROUP_PAD * 2 + GROUP_TITLE_H,
      });
    }
  }

  // Edges: orthogonal elbow on facing sides (mirrors the BPMN routing), with
  // multiple exits/entries spread along a node's edge so they don't overlap.
  const outBy = new Map<string, string[]>();
  const inBy = new Map<string, string[]>();
  for (const e of ir.edges) {
    // Only count edges that are actually drawn (both endpoints placed), so the
    // spread index/length matches the edge loop and connectors stay aligned.
    if (!placed.has(e.from) || !placed.has(e.to)) continue;
    (outBy.get(e.from) ?? outBy.set(e.from, []).get(e.from)!).push(e.id);
    (inBy.get(e.to) ?? inBy.set(e.to, []).get(e.to)!).push(e.id);
  }
  const spread = (n: ArchPlacedNode, list: string[], id: string) => {
    if (list.length <= 1) return n.cy;
    return n.y + (n.h * (list.indexOf(id) + 1)) / (list.length + 1);
  };

  const edges: ArchPlacedEdge[] = [];
  for (const e of ir.edges) {
    const s = placed.get(e.from);
    const t = placed.get(e.to);
    if (!s || !t) continue;
    const exitRight = t.cx >= s.cx;
    const sx = exitRight ? s.x + s.w : s.x;
    const tx = exitRight ? t.x : t.x + t.w;
    const sy = spread(s, outBy.get(e.from)!, e.id);
    const ty = spread(t, inBy.get(e.to)!, e.id);
    const midX = (sx + tx) / 2;
    const points: Pt[] =
      Math.abs(sy - ty) < 1
        ? [{ x: sx, y: sy }, { x: tx, y: ty }]
        : [{ x: sx, y: sy }, { x: midX, y: sy }, { x: midX, y: ty }, { x: tx, y: ty }];
    edges.push({ id: e.id, from: e.from, to: e.to, label: e.label, async: e.async, points });
  }

  // Canvas bounds: enclose nodes and group bands.
  const allBoxes = [
    ...[...placed.values()].map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })),
    ...groups.map((gr) => ({ x: gr.x, y: gr.y, w: gr.w, h: gr.h })),
  ];
  const maxRight = allBoxes.length ? Math.max(...allBoxes.map((b) => b.x + b.w)) : 0;
  const maxBottom = allBoxes.length ? Math.max(...allBoxes.map((b) => b.y + b.h)) : 0;

  return {
    groups,
    nodes: [...placed.values()],
    edges,
    width: maxRight + MARGIN,
    height: maxBottom + MARGIN,
  };
}
