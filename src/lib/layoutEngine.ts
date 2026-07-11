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
  return buildFkIndex(schema).get(tableName) ?? new Set();
}

/**
 * FK columns for every table in one pass over the refs — O(refs) instead of
 * O(tables × refs) when the per-table variant is called in a loop.
 */
export function buildFkIndex(schema: SchemaIR): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const add = (tableName: string, columns: string[]) => {
    let set = index.get(tableName);
    if (!set) {
      set = new Set();
      index.set(tableName, set);
    }
    columns.forEach((c) => set.add(c));
  };
  for (const ref of schema.refs) {
    add(ref.fromTable, ref.fromColumns);
    add(ref.toTable, ref.toColumns);
  }
  return index;
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
        if (line) out.push(line);
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
  midX: number;
}

const ROUTE_GAP = 36; // detour distance when tables overlap horizontally

/**
 * Pick the exit/enter sides and the horizontal mid-line for an edge.
 * - Tables clearly apart: connect on the facing sides, mid-line in the gap.
 * - Tables that overlap in X: exit BOTH on the same outer side and route the
 *   mid-line outside the boxes, so the connector never tunnels through a table.
 */
function chooseRouting(
  from: LayoutNode,
  to: LayoutNode
): { fromSide: "left" | "right"; toSide: "left" | "right"; midX: number } {
  const fL = from.x;
  const fR = from.x + from.width;
  const tL = to.x;
  const tR = to.x + to.width;

  if (tL >= fR) {
    return { fromSide: "right", toSide: "left", midX: (fR + tL) / 2 };
  }
  if (fL >= tR) {
    return { fromSide: "left", toSide: "right", midX: (fL + tR) / 2 };
  }
  // Horizontal overlap: route around on the side the tables lean toward.
  const leanRight = to.x + to.width / 2 >= from.x + from.width / 2;
  return leanRight
    ? { fromSide: "right", toSide: "right", midX: Math.max(fR, tR) + ROUTE_GAP }
    : { fromSide: "left", toSide: "left", midX: Math.min(fL, tL) - ROUTE_GAP };
}

/**
 * Vertical anchor for an edge endpoint: the centre of the column's row when the
 * column is visible (a meaningful, unique anchor), otherwise the vertical centre
 * of the (collapsed) table — flagged as not-anchored so it can be redistributed.
 */
function anchorY(
  node: LayoutNode,
  visibleColumns: ColumnIR[],
  columnName: string
): { y: number; anchored: boolean } {
  const idx = visibleColumns.findIndex((c) => c.name === columnName);
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
  visibleColumns: ColumnIR[],
  columnName: string,
  side: "left" | "right"
): Endpoint {
  const { y, anchored } = anchorY(node, visibleColumns, columnName);
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
  // Shared lookups, built once: O(tables + refs) instead of a scan per ref.
  const fkIndex = buildFkIndex(schema);
  const tablesByName = new Map(schema.tables.map((t) => [t.name, t]));
  const visibleByTable = new Map<string, ColumnIR[]>();
  const visibleFor = (tableName: string): ColumnIR[] => {
    let visible = visibleByTable.get(tableName);
    if (!visible) {
      const table = tablesByName.get(tableName)!;
      visible = getVisibleColumns(table, fkIndex.get(tableName) ?? new Set(), detailLevel);
      visibleByTable.set(tableName, visible);
    }
    return visible;
  };

  // Pass A: resolve sides and preferred anchors.
  const raw: RawEdge[] = [];
  const endpoints: Endpoint[] = [];
  for (const ref of schema.refs) {
    const fromNode = nodes.get(ref.fromTable);
    const toNode = nodes.get(ref.toTable);
    if (!fromNode || !toNode) continue;

    // Connect on facing sides (or route outside when the boxes overlap in X).
    const { fromSide, toSide, midX } = chooseRouting(fromNode, toNode);

    const from = makeEndpoint(fromNode, visibleFor(ref.fromTable), ref.fromColumns[0] || "", fromSide);
    const to = makeEndpoint(toNode, visibleFor(ref.toTable), ref.toColumns[0] || "", toSide);
    raw.push({ ref, from, to, midX });
    endpoints.push(from, to);
  }

  // Pass B: spread overlapping endpoints along each table edge.
  distributeEndpoints(endpoints);

  // Build the orthogonal elbow path from the resolved endpoints.
  return raw.map(({ ref, from, to, midX }) => {
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

  const fkIndex = buildFkIndex(schema);
  for (const table of schema.tables) {
    const fk = fkIndex.get(table.name) ?? new Set<string>();
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
    // EnumNode only renders values at "full" detail; reserve matching height so
    // stacked enums don't leave large empty gaps in lower detail levels.
    const h = enumHeight(
      options.detailLevel === "full" ? enumBlock.values.length : 0
    );
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
  const nodeWidth = hasSideColumn ? sideX + Math.max(TABLE_WIDTH, NOTE_WIDTH) : baseWidth;

  // Edge routing (chooseRouting) can detour a connector's elbow past the node
  // bounds via ROUTE_GAP; include edge points so the detour isn't clipped.
  let edgeMaxX = 0;
  let edgeMaxY = 0;
  for (const e of edges) {
    for (const p of e.points) {
      if (p.x > edgeMaxX) edgeMaxX = p.x;
      if (p.y > edgeMaxY) edgeMaxY = p.y;
    }
  }

  const contentWidth = Math.max(nodeWidth, edgeMaxX);
  const contentHeight = Math.max(baseHeight, sideY, edgeMaxY);

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
