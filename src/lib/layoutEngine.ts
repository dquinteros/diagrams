import dagre from "@dagrejs/dagre";
import type { SchemaIR, TableIR, ColumnIR } from "../types/schema";
import type { LayoutResult, LayoutNode, LayoutEdge, DetailLevel } from "../types/layout";
import {
  TABLE_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  TABLE_PADDING,
  NODE_SEP,
  RANK_SEP,
  MARGIN_X,
  MARGIN_Y,
  NOTE_WIDTH,
  NOTE_LINE_HEIGHT,
  NOTE_PADDING,
} from "./constants";

/** Columns that participate in a relationship for the given table. */
export function getFkColumns(schema: SchemaIR, tableName: string): Set<string> {
  const fkColumns = new Set<string>();
  for (const ref of schema.refs) {
    if (ref.fromTable === tableName) {
      ref.fromColumns.forEach((c) => fkColumns.add(c));
    }
    if (ref.toTable === tableName) {
      ref.toColumns.forEach((c) => fkColumns.add(c));
    }
  }
  return fkColumns;
}

/** The columns actually rendered for a table at the given detail level. */
export function getVisibleColumns(
  table: TableIR,
  fkColumns: Set<string>,
  detailLevel: DetailLevel
): ColumnIR[] {
  if (detailLevel === "name-only") return [];
  if (detailLevel === "keys-only") {
    return table.columns.filter((c) => c.isPk || fkColumns.has(c.name));
  }
  return table.columns;
}

function tableHeight(visibleCount: number): number {
  return HEADER_HEIGHT + visibleCount * ROW_HEIGHT + TABLE_PADDING * 2;
}

function enumHeight(valueCount: number): number {
  return HEADER_HEIGHT + valueCount * ROW_HEIGHT + TABLE_PADDING * 2;
}

export function noteHeight(content: string): number {
  const lines = Math.max(1, content.split("\n").length);
  return HEADER_HEIGHT + lines * NOTE_LINE_HEIGHT + NOTE_PADDING * 2;
}

export interface LayoutOptions {
  rankdir: "LR" | "TB";
  detailLevel: DetailLevel;
}

/**
 * Vertical anchor for an edge endpoint: the centre of the column's row when the
 * column is visible, otherwise the vertical centre of the (collapsed) table.
 */
function anchorY(
  node: LayoutNode,
  table: TableIR,
  schema: SchemaIR,
  detailLevel: DetailLevel,
  columnName: string
): number {
  const visible = getVisibleColumns(table, getFkColumns(schema, table.name), detailLevel);
  const idx = visible.findIndex((c) => c.name === columnName);
  if (idx < 0) {
    return node.y + node.height / 2;
  }
  return node.y + HEADER_HEIGHT + TABLE_PADDING + idx * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/** Build a single edge between two positioned nodes. */
function computeEdge(
  schema: SchemaIR,
  ref: SchemaIR["refs"][number],
  fromNode: LayoutNode,
  toNode: LayoutNode,
  detailLevel: DetailLevel
): LayoutEdge {
  const fromTable = schema.tables.find((t) => t.name === ref.fromTable)!;
  const toTable = schema.tables.find((t) => t.name === ref.toTable)!;

  const fromCol = ref.fromColumns[0] || "";
  const toCol = ref.toColumns[0] || "";

  const fromY = anchorY(fromNode, fromTable, schema, detailLevel, fromCol);
  const toY = anchorY(toNode, toTable, schema, detailLevel, toCol);

  // Connect on the sides facing each other so edges never loop awkwardly.
  const fromCx = fromNode.x + fromNode.width / 2;
  const toCx = toNode.x + toNode.width / 2;
  const exitRight = toCx >= fromCx;

  const fromX = exitRight ? fromNode.x + fromNode.width : fromNode.x;
  const toX = exitRight ? toNode.x : toNode.x + toNode.width;
  const fromSide: "left" | "right" = exitRight ? "right" : "left";
  const toSide: "left" | "right" = exitRight ? "left" : "right";

  const midX = (fromX + toX) / 2;

  return {
    from: ref.fromTable,
    to: ref.toTable,
    fromColumn: fromCol,
    toColumn: toCol,
    fromColumnIndex: 0,
    toColumnIndex: 0,
    relation: ref.relation,
    fromSide,
    toSide,
    points: [
      { x: fromX, y: fromY },
      { x: midX, y: fromY },
      { x: midX, y: toY },
      { x: toX, y: toY },
    ],
  };
}

function buildEdges(
  schema: SchemaIR,
  nodes: Map<string, LayoutNode>,
  detailLevel: DetailLevel
): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  for (const ref of schema.refs) {
    const fromNode = nodes.get(ref.fromTable);
    const toNode = nodes.get(ref.toTable);
    if (!fromNode || !toNode) continue;
    edges.push(computeEdge(schema, ref, fromNode, toNode, detailLevel));
  }
  return edges;
}

export function computeLayout(
  schema: SchemaIR,
  options: LayoutOptions = { rankdir: "LR", detailLevel: "full" }
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
    const fk = getFkColumns(schema, table.name);
    const visibleCount = getVisibleColumns(table, fk, options.detailLevel).length;
    g.setNode(table.name, {
      width: TABLE_WIDTH,
      height: tableHeight(visibleCount),
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

  const edges = buildEdges(schema, nodes, options.detailLevel);

  const graphInfo = g.graph();
  const baseWidth = graphInfo?.width ?? 800;
  const baseHeight = graphInfo?.height ?? 600;

  // Enums and sticky notes are not part of the dagre graph; stack them in a
  // side column to the right of the tables.
  const sideX = baseWidth + RANK_SEP;
  let sideY = MARGIN_Y;

  for (const enumBlock of schema.enums) {
    const h = enumHeight(enumBlock.values.length);
    nodes.set(`enum_${enumBlock.name}`, {
      id: `enum_${enumBlock.name}`,
      x: sideX,
      y: sideY,
      width: TABLE_WIDTH,
      height: h,
    });
    sideY += h + NODE_SEP;
  }

  for (let i = 0; i < schema.notes.length; i++) {
    const h = noteHeight(schema.notes[i].content);
    nodes.set(`note_${i}`, {
      id: `note_${i}`,
      x: sideX,
      y: sideY,
      width: NOTE_WIDTH,
      height: h,
    });
    sideY += h + NODE_SEP;
  }

  const hasSideColumn = schema.enums.length > 0 || schema.notes.length > 0;
  const contentWidth = hasSideColumn ? sideX + Math.max(TABLE_WIDTH, NOTE_WIDTH) : baseWidth;
  const contentHeight = Math.max(baseHeight, sideY);

  return {
    nodes,
    edges,
    width: contentWidth + MARGIN_X * 2,
    height: contentHeight + MARGIN_Y * 2,
  };
}

export function recomputeEdges(
  schema: SchemaIR,
  nodes: Map<string, LayoutNode>,
  detailLevel: DetailLevel
): LayoutEdge[] {
  return buildEdges(schema, nodes, detailLevel);
}
