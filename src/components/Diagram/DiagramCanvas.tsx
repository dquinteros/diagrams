import { useState, useCallback, useRef, useMemo } from "react";
import type { SchemaIR } from "../../types/schema";
import type { LayoutResult, DetailLevel } from "../../types/layout";
import { buildFkIndex } from "../../lib/layoutEngine";
import { useViewTransform } from "../../hooks/useViewTransform";
import { useNodePositions } from "../../hooks/useNodePositions";
import { useTheme } from "../../context/ThemeContext";
import { TableNode } from "./TableNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { EnumNode } from "./EnumNode";
import { StickyNoteNode } from "./StickyNoteNode";
import { ZoomControls } from "./ZoomControls";
import { Tooltip } from "./Tooltip";
import { TableGroupRect } from "./TableGroupRect";
import { SearchBar } from "./SearchBar";
import { MiniMap } from "./MiniMap";

interface HoverInfo {
  tableName: string;
  columnName?: string;
  x: number;
  y: number;
}

interface DiagramCanvasProps {
  schema: SchemaIR;
  layout: LayoutResult;
  rankdir: "LR" | "TB";
  onToggleRankdir: () => void;
  detailLevel: DetailLevel;
  onToggleDetailLevel: () => void;
  highlightedTable: string | null;
  onNavigateToSource?: (spanRange: [number, number]) => void;
  storageKey: string;
}

const DRAG_THRESHOLD = 5;
const EMPTY_FK_SET: Set<string> = new Set();

export function DiagramCanvas({
  schema,
  layout,
  rankdir,
  onToggleRankdir,
  detailLevel,
  onToggleDetailLevel,
  highlightedTable,
  onNavigateToSource,
  storageKey,
}: DiagramCanvasProps) {
  const { theme } = useTheme();
  const vt = useViewTransform(layout, storageKey);
  const np = useNodePositions(layout, schema, storageKey, detailLevel);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const dragStateRef = useRef<{
    tableName: string;
    startMouseX: number;
    startMouseY: number;
    startNodeX: number;
    startNodeY: number;
    moved: boolean;
  } | null>(null);

  // FK columns per table, one pass over the refs (shared by every TableNode).
  const fkIndex = useMemo(() => buildFkIndex(schema), [schema]);

  // Callbacks depend on the stable members of vt/np (not the container
  // objects, which change identity per render) so memoized nodes skip.
  const { nodes: npNodes, startDrag, moveNode, endDrag } = np;
  const {
    handleMouseDown: vtMouseDown,
    handleMouseMove: vtMouseMove,
    handleMouseUp: vtMouseUp,
    getTransform,
    svgRef,
  } = vt;

  const handleTableDragStart = useCallback(
    (tableName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const node = npNodes.get(tableName);
      if (!node) return;
      dragStateRef.current = {
        tableName,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNodeX: node.x,
        startNodeY: node.y,
        moved: false,
      };
      startDrag(tableName);
    },
    [npNodes, startDrag]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStateRef.current) {
        vtMouseDown(e);
        if (
          e.target === svgRef.current ||
          (e.target as Element).classList.contains("canvas-bg")
        ) {
          setSelectedTable(null);
          setSelectedEdge(null);
        }
      }
    },
    [vtMouseDown, svgRef]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const ds = dragStateRef.current;
      if (ds) {
        // Threshold in screen pixels so click-vs-drag doesn't depend on zoom.
        const sdx = e.clientX - ds.startMouseX;
        const sdy = e.clientY - ds.startMouseY;
        if (!ds.moved && Math.abs(sdx) + Math.abs(sdy) < DRAG_THRESHOLD) return;
        ds.moved = true;
        const scale = getTransform().scale;
        moveNode(
          ds.tableName,
          ds.startNodeX + sdx / scale,
          ds.startNodeY + sdy / scale
        );
      } else {
        vtMouseMove(e);
      }
    },
    [getTransform, moveNode, vtMouseMove]
  );

  const handleMouseUp = useCallback(() => {
    const ds = dragStateRef.current;
    if (ds) {
      if (!ds.moved) {
        setSelectedTable(ds.tableName);
        setSelectedEdge(null);
      }
      dragStateRef.current = null;
      endDrag();
    }
    vtMouseUp();
  }, [endDrag, vtMouseUp]);

  const handleEdgeSelect = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEdge(index);
    setSelectedTable(null);
  }, []);

  const activeTable = selectedTable ?? highlightedTable;

  const cursor = np.isDragging ? "move" : vt.isPanning ? "grabbing" : "grab";

  const tooltipContent = getTooltipContent(schema, hoverInfo);

  // The table whose relationships are emphasized: live hover takes priority,
  // otherwise the persistently selected table. Disabled while dragging.
  const hoveredTable = np.isDragging ? null : hoverInfo?.tableName ?? null;
  const focusTable = hoveredTable ?? selectedTable;

  // Tables that stay fully visible: the focused table + its direct neighbours,
  // or the endpoints of a selected relationship.
  const relatedTables = useMemo(() => {
    if (focusTable) {
      const related = new Set<string>([focusTable]);
      for (const ref of schema.refs) {
        if (ref.fromTable === focusTable) related.add(ref.toTable);
        if (ref.toTable === focusTable) related.add(ref.fromTable);
      }
      return related;
    }
    if (selectedEdge != null) {
      const edge = np.edges[selectedEdge];
      if (edge) return new Set<string>([edge.from, edge.to]);
    }
    return null;
  }, [focusTable, selectedEdge, schema.refs, np.edges]);

  const hasFocus = focusTable != null || selectedEdge != null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={vt.svgRef}
        data-diagram-svg
        width="100%"
        height="100%"
        style={{ backgroundColor: theme.canvasBg, cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <rect className="canvas-bg" width="100%" height="100%" fill={theme.canvasBg} />
        <g ref={vt.contentRef}>
          {schema.tableGroups.map((group) => (
            <TableGroupRect key={group.name} group={group} nodes={np.nodes} />
          ))}
          {np.edges.map((edge, i) => {
            const connectedToTable =
              focusTable != null && (edge.from === focusTable || edge.to === focusTable);
            const isActive = connectedToTable || selectedEdge === i;
            return (
              <RelationshipEdge
                key={`${edge.from}-${edge.to}-${i}`}
                edge={edge}
                index={i}
                isDimmed={hasFocus && !isActive}
                isHighlighted={isActive}
                isAnimated={isActive}
                onSelect={handleEdgeSelect}
              />
            );
          })}
          {schema.tables.map((table) => {
            const nodeLayout = np.nodes.get(table.name);
            if (!nodeLayout) return null;
            return (
              <TableNode
                key={table.name}
                table={table}
                layout={nodeLayout}
                fkColumns={fkIndex.get(table.name) ?? EMPTY_FK_SET}
                isSelected={activeTable === table.name}
                isDimmed={relatedTables != null && !relatedTables.has(table.name)}
                onDragStart={handleTableDragStart}
                onNavigateToSource={onNavigateToSource}
                onHover={setHoverInfo}
                detailLevel={detailLevel}
              />
            );
          })}
          {schema.enums.map((enumBlock) => {
            const nodeLayout = np.nodes.get(`enum_${enumBlock.name}`);
            if (!nodeLayout) return null;
            return (
              <EnumNode
                key={enumBlock.name}
                enumBlock={enumBlock}
                layout={nodeLayout}
                detailLevel={detailLevel}
                onDragStart={handleTableDragStart}
                onNavigateToSource={onNavigateToSource}
              />
            );
          })}
          {schema.notes.map((note, i) => {
            const nodeLayout = np.nodes.get(`note_${i}`);
            if (!nodeLayout) return null;
            return (
              <StickyNoteNode
                key={`note_${i}`}
                note={note}
                layout={nodeLayout}
                onDragStart={handleTableDragStart}
                onNavigateToSource={onNavigateToSource}
              />
            );
          })}
        </g>
      </svg>
      <ZoomControls
        store={vt.store}
        onZoomIn={vt.zoomIn}
        onZoomOut={vt.zoomOut}
        onFitToScreen={vt.fitToScreen}
        rankdir={rankdir}
        onToggleRankdir={onToggleRankdir}
        detailLevel={detailLevel}
        onToggleDetailLevel={onToggleDetailLevel}
        onResetLayout={np.resetPositions}
      />
      <SearchBar
        schema={schema}
        nodes={np.nodes}
        onNavigateToTable={vt.panToNode}
        onHighlight={setSelectedTable}
      />
      <MiniMap
        nodes={np.nodes}
        diagramWidth={layout.width}
        diagramHeight={layout.height}
        store={vt.store}
        setTransform={vt.setTransform}
        commitTransform={vt.commitTransform}
        svgRef={vt.svgRef}
      />
      {tooltipContent && hoverInfo && (
        <Tooltip x={hoverInfo.x} y={hoverInfo.y} content={tooltipContent} />
      )}
    </div>
  );
}

function getTooltipContent(schema: SchemaIR, hover: HoverInfo | null): string | null {
  if (!hover) return null;
  const table = schema.tables.find((t) => t.name === hover.tableName);
  if (!table) return null;

  if (hover.columnName) {
    const col = table.columns.find((c) => c.name === hover.columnName);
    if (!col) return null;
    const parts: string[] = [];
    const enumDef = schema.enums.find((e) => e.name === col.type);
    if (enumDef) {
      parts.push(`enum ${enumDef.name}:\n${enumDef.values.map((v) => `  ${v.name}`).join("\n")}`);
    }
    if (col.note) parts.push(col.note);
    if (col.check) parts.push(`check: ${col.check}`);
    return parts.length > 0 ? parts.join("\n") : null;
  }

  return table.note ?? null;
}
