import dagre from "@dagrejs/dagre";
import type { SchemaIR } from "../types/schema";
import type { LayoutResult, LayoutNode, LayoutEdge } from "../types/layout";
import {
  TABLE_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  TABLE_PADDING,
  NODE_SEP,
  RANK_SEP,
  MARGIN_X,
  MARGIN_Y,
} from "./constants";

function tableHeight(columnCount: number): number {
  return HEADER_HEIGHT + columnCount * ROW_HEIGHT + TABLE_PADDING * 2;
}

function findColumnIndex(
  schema: SchemaIR,
  tableName: string,
  columnName: string
): number {
  const table = schema.tables.find((t) => t.name === tableName);
  if (!table) return 0;
  const idx = table.columns.findIndex((c) => c.name === columnName);
  return idx >= 0 ? idx : 0;
}

export interface LayoutOptions {
  rankdir: "LR" | "TB";
}

export function computeLayout(
  schema: SchemaIR,
  options: LayoutOptions = { rankdir: "LR" }
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: options.rankdir,
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    marginx: MARGIN_X,
    marginy: MARGIN_Y,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const table of schema.tables) {
    g.setNode(table.name, {
      width: TABLE_WIDTH,
      height: tableHeight(table.columns.length),
    });
  }

  for (const ref of schema.refs) {
    if (g.hasNode(ref.fromTable) && g.hasNode(ref.toTable)) {
      g.setEdge(ref.fromTable, ref.toTable);
    }
  }

  dagre.layout(g);

  const nodes = new Map<string, LayoutNode>();
  for (const nodeId of g.nodes()) {
    const node = g.node(nodeId);
    if (node) {
      nodes.set(nodeId, {
        id: nodeId,
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
        width: node.width,
        height: node.height,
      });
    }
  }

  const edges: LayoutEdge[] = [];
  for (const ref of schema.refs) {
    const fromNode = nodes.get(ref.fromTable);
    const toNode = nodes.get(ref.toTable);
    if (!fromNode || !toNode) continue;

    const fromCol = ref.fromColumns[0] || "";
    const toCol = ref.toColumns[0] || "";
    const fromColIdx = findColumnIndex(schema, ref.fromTable, fromCol);
    const toColIdx = findColumnIndex(schema, ref.toTable, toCol);

    const fromY =
      fromNode.y +
      HEADER_HEIGHT +
      TABLE_PADDING +
      fromColIdx * ROW_HEIGHT +
      ROW_HEIGHT / 2;
    const toY =
      toNode.y +
      HEADER_HEIGHT +
      TABLE_PADDING +
      toColIdx * ROW_HEIGHT +
      ROW_HEIGHT / 2;

    const fromX = fromNode.x + fromNode.width;
    const toX = toNode.x;

    const midX = (fromX + toX) / 2;

    edges.push({
      from: ref.fromTable,
      to: ref.toTable,
      fromColumn: fromCol,
      toColumn: toCol,
      fromColumnIndex: fromColIdx,
      toColumnIndex: toColIdx,
      relation: ref.relation,
      points: [
        { x: fromX, y: fromY },
        { x: midX, y: fromY },
        { x: midX, y: toY },
        { x: toX, y: toY },
      ],
    });
  }

  const graphInfo = g.graph();
  return {
    nodes,
    edges,
    width: (graphInfo?.width ?? 800) + MARGIN_X * 2,
    height: (graphInfo?.height ?? 600) + MARGIN_Y * 2,
  };
}

export function recomputeEdges(
  schema: SchemaIR,
  nodes: Map<string, LayoutNode>
): LayoutEdge[] {
  const edges: LayoutEdge[] = [];

  for (const ref of schema.refs) {
    const fromNode = nodes.get(ref.fromTable);
    const toNode = nodes.get(ref.toTable);
    if (!fromNode || !toNode) continue;

    const fromCol = ref.fromColumns[0] || "";
    const toCol = ref.toColumns[0] || "";
    const fromColIdx = findColumnIndex(schema, ref.fromTable, fromCol);
    const toColIdx = findColumnIndex(schema, ref.toTable, toCol);

    const fromY =
      fromNode.y + HEADER_HEIGHT + TABLE_PADDING + fromColIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const toY =
      toNode.y + HEADER_HEIGHT + TABLE_PADDING + toColIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

    const fromX = fromNode.x + fromNode.width;
    const toX = toNode.x;
    const midX = (fromX + toX) / 2;

    edges.push({
      from: ref.fromTable,
      to: ref.toTable,
      fromColumn: fromCol,
      toColumn: toCol,
      fromColumnIndex: fromColIdx,
      toColumnIndex: toColIdx,
      relation: ref.relation,
      points: [
        { x: fromX, y: fromY },
        { x: midX, y: fromY },
        { x: midX, y: toY },
        { x: toX, y: toY },
      ],
    });
  }

  return edges;
}
