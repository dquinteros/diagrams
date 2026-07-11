import { describe, it, expect } from "vitest";
import {
  buildFkIndex,
  getFkColumns,
  computeLayout,
  recomputeEdges,
} from "./layoutEngine";
import type { SchemaIR, TableIR, RefIR } from "../types/schema";

function table(name: string, cols: string[]): TableIR {
  return {
    name,
    schema: null,
    alias: null,
    columns: cols.map((c, i) => ({
      name: c,
      type: "integer",
      isPk: i === 0,
      isUnique: false,
      isNullable: i !== 0,
      isIncremental: i === 0,
      defaultValue: null,
      note: null,
      check: null,
      spanRange: [0, 0],
    })),
    indexes: [],
    note: null,
    headerColor: null,
    spanRange: [0, 0],
  };
}

function ref(fromTable: string, fromCol: string, toTable: string, toCol: string): RefIR {
  return {
    name: null,
    relation: "many_to_one",
    fromTable,
    fromSchema: null,
    fromColumns: [fromCol],
    toTable,
    toSchema: null,
    toColumns: [toCol],
    onDelete: null,
    onUpdate: null,
    spanRange: [0, 0],
  };
}

function schemaFixture(n = 12): SchemaIR {
  const tables = [];
  const refs = [];
  for (let i = 0; i < n; i++) {
    tables.push(table(`t_${i}`, ["id", "name", "parent_id"]));
    if (i > 0) refs.push(ref(`t_${i}`, "parent_id", `t_${i - 1}`, "id"));
  }
  // A second ref onto the same table exercises endpoint distribution.
  refs.push(ref(`t_0`, "parent_id", `t_${n - 1}`, "id"));
  return { tables, refs, enums: [], tableGroups: [], notes: [], project: null };
}

describe("buildFkIndex", () => {
  it("matches getFkColumns for every table", () => {
    const schema = schemaFixture();
    const index = buildFkIndex(schema);
    for (const t of schema.tables) {
      expect(index.get(t.name) ?? new Set()).toEqual(getFkColumns(schema, t.name));
    }
  });

  it("returns no entry for tables without refs", () => {
    const schema: SchemaIR = {
      tables: [table("lonely", ["id"])],
      refs: [],
      enums: [],
      tableGroups: [],
      notes: [],
      project: null,
    };
    expect(buildFkIndex(schema).get("lonely")).toBeUndefined();
  });
});

describe("recomputeEdges", () => {
  it("produces one edge per resolvable ref, anchored on node borders", () => {
    const schema = schemaFixture();
    const layout = computeLayout(schema, { rankdir: "LR", detailLevel: "full" });
    const edges = recomputeEdges(schema, layout.nodes, "full");
    expect(edges).toHaveLength(schema.refs.length);
    for (const e of edges) {
      const from = layout.nodes.get(e.from)!;
      const start = e.points[0];
      // Endpoint x sits on the left or right border of the source node.
      expect([from.x, from.x + from.width]).toContain(start.x);
    }
  });

  it("is deterministic for the same inputs", () => {
    const schema = schemaFixture();
    const layout = computeLayout(schema, { rankdir: "LR", detailLevel: "full" });
    const a = recomputeEdges(schema, layout.nodes, "full");
    const b = recomputeEdges(schema, layout.nodes, "full");
    expect(a).toEqual(b);
  });
});
