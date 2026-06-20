import { useEffect, useRef, useState, useCallback } from "react";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import "./bpmn-theme.css";
import { compileBpmn } from "../../lib/bpmn/layout";
import { useTheme } from "../../context/ThemeContext";
import { ZoomControls } from "../Diagram/ZoomControls";

interface BpmnPaneProps {
  content: string;
}

type ViewerInstance = InstanceType<typeof NavigatedViewer>;

export default function BpmnPane({ content }: BpmnPaneProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);

  const syncZoom = useCallback(() => {
    const v = viewerRef.current;
    if (!v) return;
    setZoomPct(Math.round(v.get("canvas").zoom() * 100));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const viewer = new NavigatedViewer({ container: containerRef.current });
    viewerRef.current = viewer;
    setReady(true);
    return () => viewer.destroy();
  }, []);

  // Compile the DSL → BPMN XML (with auto-layout) and render it. Debounced.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { xml, error: compileError } = await compileBpmn(content);
      if (cancelled) return;
      if (compileError) {
        setError(compileError);
        return;
      }
      if (!xml) {
        setError(null);
        return;
      }
      try {
        await viewerRef.current!.importXML(xml);
        if (cancelled) return;
        viewerRef.current!.get("canvas").zoom("fit-viewport");
        syncZoom();
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to render BPMN");
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [content, ready, syncZoom]);

  const zoomBy = (factor: number) => {
    const v = viewerRef.current;
    if (!v) return;
    const c = v.get("canvas");
    c.zoom(c.zoom() * factor);
    syncZoom();
  };
  const fit = () => {
    viewerRef.current?.get("canvas").zoom("fit-viewport");
    syncZoom();
  };

  const cssVars = {
    "--bpmn-stroke": theme.tableBorder, // ER card border
    "--bpmn-fill": theme.tableHeader, // ER header fill
    "--bpmn-edge": theme.edgeLine, // ER relationship line
    "--bpmn-band": theme.groupBg, // ER table-group band
    "--bpmn-text": theme.headerText,
    "--bpmn-accent": theme.tableBorderSelected,
  } as React.CSSProperties;

  return (
    <div
      className="bpmn-themed"
      style={{ position: "relative", width: "100%", height: "100%", backgroundColor: theme.canvasBg, ...cssVars }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <ZoomControls
        zoomPercentage={zoomPct}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(0.8)}
        onFitToScreen={fit}
      />
      {error && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            maxWidth: "80%",
            backgroundColor: theme.errorText,
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
