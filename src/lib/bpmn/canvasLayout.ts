import type { BpmnIR, BpmnNodeKind } from "./types";

// Pure geometry for the in-app BPMN renderer (no bpmn-js). Columns come from a
// longest-path rank; nodes in the same column/lane stack vertically so branches
// (e.g. a gateway's targets) separate cleanly.

const COL_SPACING = 180;
const ROW_SLOT = 110;
const LANE_LABEL_W = 28;
const PAD_X = 48;
const PAD_Y = 40;
const LANE_MIN_H = 150;

export interface BpmnPlacedNode {
  id: string;
  kind: BpmnNodeKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}
export interface BpmnPlacedEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  points: { x: number; y: number }[];
}
export interface BpmnLaneBand {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface BpmnCanvasLayout {
  lanes: BpmnLaneBand[];
  nodes: BpmnPlacedNode[];
  edges: BpmnPlacedEdge[];
  width: number;
  height: number;
}

export function bpmnNodeSize(kind: BpmnNodeKind): { w: number; h: number } {
  if (kind === "start" || kind === "end" || kind === "event") return { w: 40, h: 40 };
  if (kind === "xor" || kind === "and") return { w: 52, h: 52 };
  return { w: 120, h: 72 };
}

function rankNodes(ir: BpmnIR): Map<string, number> {
  const rank = new Map<string, number>();
  for (const n of ir.nodes) rank.set(n.id, 0);
  for (let i = 0; i < ir.nodes.length; i++) {
    let changed = false;
    for (const f of ir.flows) {
      const r = (rank.get(f.from) ?? 0) + 1;
      if (r > (rank.get(f.to) ?? 0)) {
        rank.set(f.to, r);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return rank;
}

export function computeBpmnLayout(ir: BpmnIR): BpmnCanvasLayout {
  const useLanes = ir.lanes.length > 0;
  const laneList = [...ir.lanes];
  if (useLanes && ir.nodes.some((n) => !n.lane || !laneList.includes(n.lane))) laneList.push("");
  const laneIndex = (laneName?: string) => {
    if (!useLanes) return 0;
    const i = laneName ? laneList.indexOf(laneName) : -1;
    return i >= 0 ? i : laneList.length - 1;
  };

  const rank = rankNodes(ir);
  // startX is the *center* of column 0, so pad by half the widest node in
  // that column to keep left edges out of negative x / the lane-label strip.
  const firstColHalfW = Math.max(
    0,
    ...ir.nodes
      .filter((n) => (rank.get(n.id) ?? 0) === 0)
      .map((n) => bpmnNodeSize(n.kind).w / 2)
  );
  const startX = (useLanes ? LANE_LABEL_W : 0) + PAD_X + firstColHalfW;

  // Bucket nodes by lane → column to stack same-column siblings vertically.
  type Bucket = Map<number, string[]>; // col -> node ids
  const laneBuckets: Bucket[] = laneList.length ? laneList.map(() => new Map()) : [new Map()];
  for (const n of ir.nodes) {
    const li = laneIndex(n.lane);
    const col = rank.get(n.id) ?? 0;
    const bucket = laneBuckets[li] ?? laneBuckets[0];
    (bucket.get(col) ?? bucket.set(col, []).get(col)!).push(n.id);
  }

  // Lane heights from the tallest column stack in each lane.
  const laneHeights = laneBuckets.map((b) => {
    const maxStack = Math.max(1, ...[...b.values()].map((ids) => ids.length));
    return Math.max(LANE_MIN_H, maxStack * ROW_SLOT);
  });
  const laneTops: number[] = [];
  let acc = useLanes ? 0 : PAD_Y;
  for (const h of laneHeights) {
    laneTops.push(acc);
    acc += h;
  }

  const geom = new Map<string, BpmnPlacedNode>();
  const node = (id: string) => ir.nodes.find((n) => n.id === id)!;
  for (let li = 0; li < laneBuckets.length; li++) {
    const bucket = laneBuckets[li];
    const bandTop = laneTops[li];
    const bandH = laneHeights[li];
    for (const [col, ids] of bucket) {
      ids.forEach((id, k) => {
        const n = node(id);
        const { w, h } = bpmnNodeSize(n.kind);
        const cx = startX + col * COL_SPACING;
        const slotOffset = (k - (ids.length - 1) / 2) * ROW_SLOT;
        const cy = bandTop + bandH / 2 + slotOffset;
        geom.set(id, { id, kind: n.kind, label: n.label, x: cx - w / 2, y: cy - h / 2, w, h, cx, cy });
      });
    }
  }

  // Edges: distribute multiple exits/entries across a node's edge.
  const outBy = new Map<string, string[]>();
  const inBy = new Map<string, string[]>();
  for (const f of ir.flows) {
    // Only count flows that are actually drawn (both endpoints placed), so the
    // spread index/length matches the edge loop and connectors stay aligned.
    if (!geom.has(f.from) || !geom.has(f.to)) continue;
    (outBy.get(f.from) ?? outBy.set(f.from, []).get(f.from)!).push(f.id);
    (inBy.get(f.to) ?? inBy.set(f.to, []).get(f.to)!).push(f.id);
  }
  const spread = (g: BpmnPlacedNode, list: string[], id: string) => {
    const n = list.length;
    if (n <= 1) return g.cy;
    return g.y + (g.h * (list.indexOf(id) + 1)) / (n + 1);
  };

  const edges: BpmnPlacedEdge[] = [];
  for (const f of ir.flows) {
    const s = geom.get(f.from);
    const t = geom.get(f.to);
    if (!s || !t) continue;
    const exitRight = t.cx >= s.cx;
    const sx = exitRight ? s.x + s.w : s.x;
    const tx = exitRight ? t.x : t.x + t.w;
    const sy = spread(s, outBy.get(f.from)!, f.id);
    const ty = spread(t, inBy.get(f.to)!, f.id);
    const midX = (sx + tx) / 2;
    const points =
      Math.abs(sy - ty) < 1
        ? [{ x: sx, y: sy }, { x: tx, y: ty }]
        : [{ x: sx, y: sy }, { x: midX, y: sy }, { x: midX, y: ty }, { x: tx, y: ty }];
    edges.push({ id: f.id, from: f.from, to: f.to, label: f.label, points });
  }

  const maxRight = Math.max(startX, ...[...geom.values()].map((g) => g.x + g.w));
  const width = maxRight + PAD_X + (useLanes ? 0 : 0);
  const contentBottom = acc + (useLanes ? 0 : PAD_Y);
  const height = contentBottom + (useLanes ? 0 : 0);

  const lanes: BpmnLaneBand[] = useLanes
    ? laneList.map((name, i) => ({
        name,
        x: 0,
        y: laneTops[i],
        w: width,
        h: laneHeights[i],
      }))
    : [];

  return { lanes, nodes: [...geom.values()], edges, width, height };
}
