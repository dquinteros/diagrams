import type { SchemaIR } from "../types/schema";
import type { LayoutResult, DetailLevel } from "../types/layout";
import type { DiagramType } from "../lib/diagramTypes";
import type { SeqLayout } from "../lib/sequence/layout";
import type { BpmnCanvasLayout } from "../lib/bpmn/canvasLayout";
import { DiagramCanvas } from "./Diagram/DiagramCanvas";
import { SequenceCanvas } from "./Sequence/SequenceCanvas";
import { BpmnCanvas } from "./Bpmn/BpmnCanvas";

interface DiagramViewProps {
  type: DiagramType;
  // DBML render inputs:
  schema: SchemaIR | null;
  layout: LayoutResult;
  rankdir: "LR" | "TB";
  onToggleRankdir: () => void;
  detailLevel: DetailLevel;
  onToggleDetailLevel: () => void;
  highlightedTable: string | null;
  onNavigateToSource?: (spanRange: [number, number]) => void;
  storageKey: string;
  // Sequence / BPMN render inputs:
  seqLayout: SeqLayout | null;
  bpmnLayout: BpmnCanvasLayout | null;
}

/** Right-pane renderer, dispatched by diagram type. All types share the same
 *  SVG canvas chrome (pan/zoom, minimap, hover highlight) for a consistent look. */
export function DiagramView(props: DiagramViewProps) {
  if (props.type === "dbml") {
    if (!props.schema) return null;
    return (
      <DiagramCanvas
        schema={props.schema}
        layout={props.layout}
        rankdir={props.rankdir}
        onToggleRankdir={props.onToggleRankdir}
        detailLevel={props.detailLevel}
        onToggleDetailLevel={props.onToggleDetailLevel}
        highlightedTable={props.highlightedTable}
        onNavigateToSource={props.onNavigateToSource}
        storageKey={props.storageKey}
      />
    );
  }

  if (props.type === "sequence") {
    if (!props.seqLayout) return null;
    return <SequenceCanvas layout={props.seqLayout} storageKey={props.storageKey} />;
  }

  if (props.type === "bpmn") {
    if (!props.bpmnLayout) return null;
    return <BpmnCanvas layout={props.bpmnLayout} storageKey={props.storageKey} />;
  }

  return null;
}
