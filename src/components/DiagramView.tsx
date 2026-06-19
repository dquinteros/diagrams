import { lazy, Suspense } from "react";
import type { SchemaIR } from "../types/schema";
import type { LayoutResult, DetailLevel } from "../types/layout";
import type { DiagramType } from "../lib/diagramTypes";
import type { SeqLayout } from "../lib/sequence/layout";
import { DiagramCanvas } from "./Diagram/DiagramCanvas";
import { SequenceCanvas } from "./Sequence/SequenceCanvas";
import { useTheme } from "../context/ThemeContext";

// bpmn-js is heavy; load it only when a BPMN document is shown.
const BpmnPane = lazy(() => import("./Bpmn/BpmnPane"));

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
  // Sequence render input:
  seqLayout: SeqLayout | null;
  // Generic (bpmn) inputs:
  content: string;
  onContentChange: (value: string) => void;
}

/** Right-pane renderer, dispatched by diagram type. */
export function DiagramView(props: DiagramViewProps) {
  const { theme } = useTheme();

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
    return (
      <Suspense
        fallback={
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.toolbarTextMuted,
              fontFamily: "monospace",
              fontSize: 13,
            }}
          >
            Loading BPMN editor…
          </div>
        }
      >
        <BpmnPane content={props.content} />
      </Suspense>
    );
  }

  return null;
}
