import { describe, it, expect } from "vitest";
import { visibleRect, cullNodes, edgeVisible } from "./viewportCulling";
import type { LayoutNode } from "../types/layout";

const node = (id: string, x: number, y: number, w = 220, h = 100): [string, LayoutNode] => [
  id,
  { id, x, y, width: w, height: h },
];

describe("visibleRect", () => {
  it("maps the viewport into diagram coordinates", () => {
    // Default camera (translate 40,40) at scale 1.
    const r = visibleRect({ x: 40, y: 40, scale: 1 }, 1000, 800, 0);
    expect(r).toEqual({ x: -40, y: -40, w: 1000, h: 800 });
  });

  it("accounts for pan and zoom", () => {
    // Panned right/down by 100 screen px at scale 2: diagram origin -50,-50.
    const r = visibleRect({ x: 100, y: 100, scale: 2 }, 1000, 800, 0);
    expect(r.x).toBe(-50);
    expect(r.y).toBe(-50);
    expect(r.w).toBe(500);
    expect(r.h).toBe(400);
  });

  it("expands by the overscan in diagram units", () => {
    const r = visibleRect({ x: 0, y: 0, scale: 1 }, 1000, 800, 200);
    expect(r).toEqual({ x: -200, y: -200, w: 1400, h: 1200 });
  });
});

describe("cullNodes", () => {
  const rect = { x: 0, y: 0, w: 1000, h: 800 };

  it("keeps nodes intersecting the rect and drops the rest", () => {
    const nodes = new Map([
      node("inside", 100, 100),
      node("straddling", -100, 700), // partially inside
      node("outside-right", 2000, 100),
      node("outside-above", 100, -500),
    ]);
    const visible = cullNodes(nodes, rect);
    expect(visible.has("inside")).toBe(true);
    expect(visible.has("straddling")).toBe(true);
    expect(visible.has("outside-right")).toBe(false);
    expect(visible.has("outside-above")).toBe(false);
  });

  it("keeps a node exactly touching the edge", () => {
    const nodes = new Map([node("touching", 1000, 0)]);
    // x === rect right edge: zero-width overlap counts as visible.
    expect(cullNodes(nodes, rect).has("touching")).toBe(true);
  });
});

describe("edgeVisible", () => {
  const rect = { x: 0, y: 0, w: 1000, h: 800 };

  it("is true when any point lies inside", () => {
    expect(edgeVisible([{ x: -50, y: -50 }, { x: 500, y: 400 }], rect)).toBe(true);
  });

  it("is true when the polyline bbox spans the rect without points inside", () => {
    // Vertical elbow crossing the whole viewport left-to-right above/below.
    expect(edgeVisible([{ x: -100, y: 400 }, { x: 2000, y: 400 }], rect)).toBe(true);
  });

  it("is false when fully outside", () => {
    expect(edgeVisible([{ x: 1500, y: 900 }, { x: 2000, y: 1200 }], rect)).toBe(false);
  });

  it("handles empty point lists", () => {
    expect(edgeVisible([], rect)).toBe(false);
  });
});
