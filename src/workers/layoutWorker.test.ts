import { describe, it, expect } from "vitest";
import { handleLayoutRequest, type LayoutRequest } from "./layoutWorker";
import type { LayoutResult } from "../types/layout";
import type { ArchCanvasLayout } from "../lib/architecture/layout";
import type { SchemaIR } from "../types/schema";
import type { ArchIR } from "../lib/architecture/types";

const schema: SchemaIR = {
  tables: [
    {
      name: "users",
      schema: null,
      alias: null,
      columns: [
        {
          name: "id",
          type: "integer",
          isPk: true,
          isUnique: false,
          isNullable: false,
          isIncremental: true,
          defaultValue: null,
          note: null,
          check: null,
          spanRange: [0, 0],
        },
      ],
      indexes: [],
      note: null,
      headerColor: null,
      spanRange: [0, 0],
    },
  ],
  refs: [],
  enums: [],
  tableGroups: [],
  notes: [],
  project: null,
};

const archIR: ArchIR = {
  nodes: [
    { id: "a", kind: "service", label: "A", group: undefined },
    { id: "b", kind: "database", label: "B", group: undefined },
  ],
  edges: [{ id: "e1", from: "a", to: "b", label: undefined, async: false }],
  groups: [],
};

describe("handleLayoutRequest", () => {
  it("computes a dbml layout and echoes the request id", () => {
    const req: LayoutRequest = {
      id: 7,
      job: { kind: "dbml", schema, options: { rankdir: "LR", detailLevel: "full" } },
    };
    const res = handleLayoutRequest(req);
    expect(res.id).toBe(7);
    if (!res.ok) throw new Error(res.error);
    const layout = res.layout as LayoutResult;
    expect(layout.nodes.get("users")).toBeDefined();
    expect(layout.width).toBeGreaterThan(0);
  });

  it("computes an architecture layout", () => {
    const req: LayoutRequest = { id: 1, job: { kind: "arch", ir: archIR } };
    const res = handleLayoutRequest(req);
    if (!res.ok) throw new Error(res.error);
    const layout = res.layout as ArchCanvasLayout;
    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(1);
  });

  it("returns ok:false with the id preserved when the job throws", () => {
    const req = {
      id: 3,
      // Malformed payload: forces a runtime error inside the layout fn.
      job: { kind: "arch", ir: null as unknown as ArchIR },
    } as LayoutRequest;
    const res = handleLayoutRequest(req);
    expect(res.ok).toBe(false);
    expect(res.id).toBe(3);
  });
});
