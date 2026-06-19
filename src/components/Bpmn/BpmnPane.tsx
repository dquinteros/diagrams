import { useEffect, useRef, useState } from "react";
import Modeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { useTheme } from "../../context/ThemeContext";

interface BpmnPaneProps {
  content: string;
  onContentChange: (xml: string) => void;
}

type ModelerInstance = InstanceType<typeof Modeler>;

export default function BpmnPane({ content, onContentChange }: BpmnPaneProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<ModelerInstance | null>(null);
  // Last XML the pane imported or emitted — used to break the sync echo loop.
  const lastXmlRef = useRef<string>("");
  const fromDiagramRef = useRef(false);
  const onChangeRef = useRef(onContentChange);
  onChangeRef.current = onContentChange;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  async function importXml(xml: string) {
    const m = modelerRef.current;
    if (!m || !xml.trim()) return;
    try {
      await m.importXML(xml);
      m.get("canvas").zoom("fit-viewport");
      lastXmlRef.current = xml;
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid BPMN XML");
    }
  }

  // Initialise the modeler once.
  useEffect(() => {
    if (!containerRef.current) return;
    const modeler = new Modeler({ container: containerRef.current });
    modelerRef.current = modeler;

    modeler.on("commandStack.changed", () => {
      modeler
        .saveXML({ format: true })
        .then(({ xml }) => {
          if (xml && xml !== lastXmlRef.current) {
            lastXmlRef.current = xml;
            fromDiagramRef.current = true; // mark origin so we skip re-import
            onChangeRef.current(xml);
          }
        })
        .catch(() => {});
    });

    setReady(true);
    void importXml(content);

    return () => modeler.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External (editor) XML edits → diagram, unless the change came from the diagram.
  useEffect(() => {
    if (!ready) return;
    if (fromDiagramRef.current) {
      fromDiagramRef.current = false;
      return;
    }
    if (content === lastXmlRef.current) return;
    const t = setTimeout(() => void importXml(content), 400);
    return () => clearTimeout(t);
  }, [content, ready]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", backgroundColor: "#fff" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
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
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
