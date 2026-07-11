import { describe, it, expect } from "vitest";
import { computeBpmnLayout } from "./canvasLayout";
import type { BpmnIR } from "./types";

const chain: BpmnIR = {
  nodes: [
    { id: "a", kind: "start", label: "A", lane: "L1" },
    { id: "b", kind: "task", label: "B", lane: "L1" },
    { id: "c", kind: "end", label: "C", lane: "L1" },
  ],
  flows: [
    { id: "f1", from: "a", to: "b", label: undefined },
    { id: "f2", from: "b", to: "c", label: undefined },
  ],
  lanes: ["L1"],
};

const branched: BpmnIR = {
  nodes: [
    { id: "s", kind: "start", label: "S", lane: undefined },
    { id: "g", kind: "xor", label: "G", lane: undefined },
    { id: "x", kind: "task", label: "X", lane: undefined },
    { id: "y", kind: "task", label: "Y", lane: undefined },
  ],
  flows: [
    { id: "f1", from: "s", to: "g", label: undefined },
    { id: "f2", from: "g", to: "x", label: "yes" },
    { id: "f3", from: "g", to: "y", label: "no" },
  ],
  lanes: [],
};

describe("computeBpmnLayout", () => {
  it("ranks a chain into consecutive columns", () => {
    const layout = computeBpmnLayout(chain);
    const cx = (id: string) => layout.nodes.find((n) => n.id === id)!.cx;
    expect(cx("b") - cx("a")).toBe(180); // COL_SPACING
    expect(cx("c") - cx("b")).toBe(180);
  });

  it("stacks branch targets vertically in the same column", () => {
    const layout = computeBpmnLayout(branched);
    const node = (id: string) => layout.nodes.find((n) => n.id === id)!;
    expect(node("x").cx).toBe(node("y").cx);
    expect(node("x").cy).not.toBe(node("y").cy);
  });

  it("produces one placed edge per flow with endpoints on node borders", () => {
    const layout = computeBpmnLayout(branched);
    expect(layout.edges).toHaveLength(branched.flows.length);
    for (const e of layout.edges) {
      const s = layout.nodes.find((n) => n.id === e.from)!;
      expect([s.x, s.x + s.w]).toContain(e.points[0].x);
    }
  });

  it("is deterministic", () => {
    const a = computeBpmnLayout(branched);
    const b = computeBpmnLayout(branched);
    expect(a).toEqual(b);
  });

  it("terminates on cyclic flows", () => {
    const cyclic: BpmnIR = {
      nodes: [
        { id: "a", kind: "task", label: "A", lane: undefined },
        { id: "b", kind: "task", label: "B", lane: undefined },
      ],
      flows: [
        { id: "f1", from: "a", to: "b", label: undefined },
        { id: "f2", from: "b", to: "a", label: undefined },
      ],
      lanes: [],
    };
    const layout = computeBpmnLayout(cyclic);
    expect(layout.nodes).toHaveLength(2);
  });

  it("scales linearly: 1000-node chain lays out in a few ms", () => {
    const n = 1000;
    const nodes = Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      kind: "task" as const,
      label: `N${i}`,
      lane: `L${Math.floor(i / 25)}`,
    }));
    const flows = Array.from({ length: n - 1 }, (_, i) => ({
      id: `f${i}`,
      from: `n${i}`,
      to: `n${i + 1}`,
      label: undefined,
    }));
    const lanes = Array.from({ length: Math.ceil(n / 25) }, (_, i) => `L${i}`);
    const t0 = performance.now();
    const layout = computeBpmnLayout({ nodes, flows, lanes });
    const elapsed = performance.now() - t0;
    expect(layout.nodes).toHaveLength(n);
    expect(elapsed).toBeLessThan(20); // generous CI margin; O(V×E) took ~50ms+
  });
});
