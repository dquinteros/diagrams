export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
  fromColumnIndex: number;
  toColumnIndex: number;
  relation: string;
  points: { x: number; y: number }[];
}

export interface LayoutResult {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  width: number;
  height: number;
}
