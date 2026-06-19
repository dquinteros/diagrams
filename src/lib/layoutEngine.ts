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
  NOTE_CHAR_WIDTH,
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

/** Word-wrap sticky-note content to the note width (SVG text doesn't wrap). */
export function wrapNoteText(content: string): string[] {
  const maxChars = Math.max(
    1,
    Math.floor((NOTE_WIDTH - NOTE_PADDING * 2) / NOTE_CHAR_WIDTH)
  );
  const out: string[] = [];
  for (const rawLine of content.split("\n")) {
    if (rawLine.length <= maxChars) {
      out.push(rawLine);
      continue;
    }
    let line = "";
    for (const word of rawLine.split(/\s+/)) {
      if (word.length > maxChars) {
        // Hard-split words longer than a full line.
        if (line) {
          out.push(line);
          line = "";
        }
        let rest = word;
        while (rest.length > maxChars) {
          out.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        line = rest;
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

export function noteHeight(content: string): number {
  const lines = wrapNoteText(content).length;
  return HEADER_HEIGHT + lines * NOTE_LINE_HEIGHT + NOTE_PADDING * 2;
}

export interface LayoutOptions {
  rankdir: "LR" | "TB";
  detailLevel: DetailLevel;
}

// Endpoint distribution tuning.
const ENDPOINT_PAD = 8; // inset from the top/bottom of a table edge
const MIN_ENDPOINT_SEP = 14; // below this, endpoints are considered overlapping

/** One end of an edge, anchored on a table's vertical edge. */
interface Endpoint {
  node: LayoutNode;
  side: "left" | "right";
  x: number;
  y: number;
  anchored: boolean; // true when y points at a real (visible) column row
}

interface RawEdge {
  ref: SchemaIR["refs"][number];
  from: Endpoint;
  to: Endpoint;
}

/**
 * Vertical anchor for an edge endpoint: the centre of the column's row when the
 * column is visible (a meaningful, unique anchor), otherwise the vertical centre
 * of the (collapsed) table — flagged as not-anchored so it can be redistributed.
 */
function anchorY(
  node: LayoutNode,
  table: TableIR,
  schema: SchemaIR,
  detailLevel: DetailLevel,
  columnName: string
): { y: number; anchored: boolean } {
  const visible = getVisibleColumns(table, getFkColumns(schema, table.name), detailLevel);
  const idx = visible.findIndex((c) => c.name === columnName);
  if (idx < 0) {
    return { y: node.y + node.height / 2, anchored: false };
  }
  return {
    y: node.y + HEADER_HEIGHT + TABLE_PADDING + idx * ROW_HEIGHT + ROW_HEIGHT / 2,
    anchored: true,
  };
}

function makeEndpoint(
  node: LayoutNode,
  table: TableIR,
  schema: SchemaIR,
  detailLevel: DetailLevel,
  columnName: string,
  side: "left" | "right"
): Endpoint {
  const { y, anchored } = anchorY(node, table, schema, detailLevel, columnName);
  const x = side === "right" ? node.x + node.width : node.x;
  return { node, side, x, y, anchored };
}

/**
 * Spread endpoints that share a table edge so their markers don't overlap.
 * Edges pointing at distinct visible columns are left untouched (meaningful
 * anchors); collapsed/colliding endpoints are distributed evenly along the edge.
 */
function distributeEndpoints(endpoints: Endpoint[]): void {
  const groups = new Map<string, Endpoint[]>();
  for (const ep of endpoints) {
    const key = `${ep.node.id}|${ep.side}`;
    const group = groups.get(key);
    if (group) group.push(ep);
    else groups.set(key, [ep]);
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => a.y - b.y);

    const allAnchored = sorted.every((e) => e.anchored);
    let collides = false;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].y - sorted[i - 1].y < MIN_ENDPOINT_SEP) {
        collides = true;
        break;
      }
    }
    // Distinct, real column anchors: keep them as-is.
    if (allAnchored && !collides) continue;

    const { y: nodeY, height } = sorted[0].node;
    const top = nodeY + ENDPOINT_PAD;
    const bottom = nodeY + height - ENDPOINT_PAD;
    const n = sorted.length;
    for (let i = 0; i < n; i++) {
      sorted[i].y = top + ((bottom - top) * (i + 1)) / (n + 1);
    }
  }
}

/** Build all edges with non-overlapping connection points. */
function buildEdges(
  schema: SchemaIR,
  nodes: Map<string, LayoutNode>,
  detailLevel: DetailLevel
): LayoutEdge[] {
  // Pass A: resolve sides and preferred anchors.
  const raw: RawEdge[] = [];
  const endpoints: Endpoint[] = [];
  for (const ref of schema.refs) {
    const fromNode = nodes.get(ref.fromTable);
    const toNode = nodes.get(ref.toTable);
    if (!fromNode || !toNode) continue;
    const fromTable = schema.tables.find((t) => t.name === ref.fromTable)!;
    const toTable = schema.tables.find((t) => t.name === ref.toTable)!;

    // Connect on the sides facing each other so edges never loop awkwardly.
    const exitRight = toNode.x + toNode.width / 2 >= fromNode.x + fromNode.width / 2;
    const fromSide: "left" | "right" = exitRight ? "right" : "left";
    const toSide: "left" | "right" = exitRight ? "left" : "right";

    const from = makeEndpoint(fromNode, fromTable, schema, detailLevel, ref.fromColumns[0] || "", fromSide);
    const to = makeEndpoint(toNode, toTable, schema, detailLevel, ref.toColumns[0] || "", toSide);
    raw.push({ ref, from, to });
    endpoints.push(from, to);
  }

  // Pass B: spread overlapping endpoints along each table edge.
  distributeEndpoints(endpoints);

  // Build the orthogonal elbow path from the resolved endpoints.
  return raw.map(({ ref, from, to }) => {
    const midX = (from.x + to.x) / 2;
    return {
      from: ref.fromTable,
      to: ref.toTable,
      fromColumn: ref.fromColumns[0] || "",
      toColumn: ref.toColumns[0] || "",
      fromColumnIndex: 0,
      toColumnIndex: 0,
      relation: ref.relation,
      fromSide: from.side,
      toSide: to.side,
      points: [
        { x: from.x, y: from.y },
        { x: midX, y: from.y },
        { x: midX, y: to.y },
        { x: to.x, y: to.y },
      ],
    };
  });
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
