import type { BpmnIR, BpmnNode } from "./types";
import { escXml, flowNodesXml, sequenceFlowsXml } from "./toXml";

// bpmn-auto-layout ignores lanes, so when lanes are used we compute the full
// diagram interchange (pool + lane bands + node/edge geometry) ourselves.

const POOL_LABEL_W = 30;
const LANE_LABEL_W = 30;
const START_X = POOL_LABEL_W + LANE_LABEL_W + 50;
const COL_SPACING = 170;
const LANE_HEIGHT = 130;

function nodeSize(n: BpmnNode): { w: number; h: number } {
  switch (n.kind) {
    case "start":
    case "end":
    case "event":
      return { w: 36, h: 36 };
    case "xor":
    case "and":
      return { w: 50, h: 50 };
    default:
      return { w: 100, h: 80 };
  }
}

/** Longest-path rank (flow depth) per node → horizontal column. */
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

export function buildLaneXml(ir: BpmnIR): string {
  // Lane list: declared lanes, plus a trailing unnamed lane for stray nodes.
  const lanes = [...ir.lanes];
  const hasUnassigned = ir.nodes.some((n) => !n.lane || !lanes.includes(n.lane));
  if (hasUnassigned) lanes.push("");
  const laneIndex = (n: BpmnNode) => {
    const idx = n.lane ? lanes.indexOf(n.lane) : -1;
    return idx >= 0 ? idx : lanes.length - 1;
  };

  const rank = rankNodes(ir);

  // Assign a distinct column per node within each lane so same-rank siblings in
  // the same lane don't overlap (auto-layout would, but we control geometry).
  const sorted = [...ir.nodes].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const laneUsedCols = new Map<number, Set<number>>();
  const colOf = new Map<string, number>();
  for (const n of sorted) {
    const li = laneIndex(n);
    const used = laneUsedCols.get(li) ?? new Set<number>();
    let col = rank.get(n.id) ?? 0;
    while (used.has(col)) col++;
    used.add(col);
    laneUsedCols.set(li, used);
    colOf.set(n.id, col);
  }
  const maxCol = Math.max(0, ...colOf.values());

  // Node geometry.
  const geom = new Map<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>();
  for (const n of ir.nodes) {
    const { w, h } = nodeSize(n);
    const cx = START_X + (colOf.get(n.id) ?? 0) * COL_SPACING;
    const li = laneIndex(n);
    const cy = li * LANE_HEIGHT + LANE_HEIGHT / 2;
    geom.set(n.id, { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy });
  }

  const poolWidth = START_X + maxCol * COL_SPACING + 80;
  const poolHeight = lanes.length * LANE_HEIGHT;

  // Lane membership (flowNodeRef) per lane.
  const laneXml = lanes
    .map((name, i) => {
      const refs = ir.nodes
        .filter((n) => laneIndex(n) === i)
        .map((n) => `        <bpmn:flowNodeRef>${escXml(n.id)}</bpmn:flowNodeRef>`)
        .join("\n");
      const nameAttr = name ? ` name="${escXml(name)}"` : "";
      return `      <bpmn:lane id="Lane_${i}"${nameAttr}>\n${refs}\n      </bpmn:lane>`;
    })
    .join("\n");

  // DI shapes.
  const poolShape = `      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="0" y="0" width="${poolWidth}" height="${poolHeight}" />
      </bpmndi:BPMNShape>`;
  const laneShapes = lanes
    .map(
      (_, i) => `      <bpmndi:BPMNShape id="Lane_${i}_di" bpmnElement="Lane_${i}" isHorizontal="true">
        <dc:Bounds x="${POOL_LABEL_W}" y="${i * LANE_HEIGHT}" width="${poolWidth - POOL_LABEL_W}" height="${LANE_HEIGHT}" />
      </bpmndi:BPMNShape>`
    )
    .join("\n");
  const nodeShapes = ir.nodes
    .map((n) => {
      const g = geom.get(n.id)!;
      return `      <bpmndi:BPMNShape id="${escXml(n.id)}_di" bpmnElement="${escXml(n.id)}">
        <dc:Bounds x="${Math.round(g.x)}" y="${Math.round(g.y)}" width="${g.w}" height="${g.h}" />
      </bpmndi:BPMNShape>`;
    })
    .join("\n");

  // Distribute multiple flows across a node's edge so branches (e.g. a gateway's
  // outgoing flows) exit/enter at distinct points instead of stacking.
  const outByNode = new Map<string, string[]>();
  const inByNode = new Map<string, string[]>();
  for (const f of ir.flows) {
    (outByNode.get(f.from) ?? outByNode.set(f.from, []).get(f.from)!).push(f.id);
    (inByNode.get(f.to) ?? inByNode.set(f.to, []).get(f.to)!).push(f.id);
  }
  const spread = (box: { y: number; h: number }, list: string[], id: string) => {
    const n = list.length;
    if (n <= 1) return box.y + box.h / 2;
    const i = list.indexOf(id);
    return box.y + (box.h * (i + 1)) / (n + 1);
  };

  const edgeShapes = ir.flows
    .map((f) => {
      const s = geom.get(f.from);
      const t = geom.get(f.to);
      if (!s || !t) return "";
      const exitRight = t.cx >= s.cx;
      const sx = Math.round(exitRight ? s.x + s.w : s.x);
      const tx = Math.round(exitRight ? t.x : t.x + t.w);
      const sy = Math.round(spread(s, outByNode.get(f.from)!, f.id));
      const ty = Math.round(spread(t, inByNode.get(f.to)!, f.id));
      const midX = Math.round((sx + tx) / 2);
      const pts =
        Math.abs(sy - ty) < 1
          ? [`<di:waypoint x="${sx}" y="${sy}" />`, `<di:waypoint x="${tx}" y="${ty}" />`]
          : [
              `<di:waypoint x="${sx}" y="${sy}" />`,
              `<di:waypoint x="${midX}" y="${sy}" />`,
              `<di:waypoint x="${midX}" y="${ty}" />`,
              `<di:waypoint x="${tx}" y="${ty}" />`,
            ];
      // Condition label near the source exit (BPMN convention for gateways).
      const lx = exitRight ? sx + 8 : sx - 8 - f.label!.length * 7;
      const label = f.label
        ? `\n        <bpmndi:BPMNLabel><dc:Bounds x="${lx}" y="${sy - 20}" width="${f.label.length * 7}" height="14" /></bpmndi:BPMNLabel>`
        : "";
      return `      <bpmndi:BPMNEdge id="${escXml(f.id)}_di" bpmnElement="${escXml(f.id)}">
        ${pts.join("\n        ")}${label}
      </bpmndi:BPMNEdge>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="Process" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
${laneXml}
    </bpmn:laneSet>
${flowNodesXml(ir)}
${sequenceFlowsXml(ir)}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
${poolShape}
${laneShapes}
${nodeShapes}
${edgeShapes}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}
