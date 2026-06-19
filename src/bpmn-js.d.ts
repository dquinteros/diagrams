// bpmn-js ships no TypeScript declarations; expose the deep entries as `any`.
interface BpmnCanvas {
  zoom: (level?: number | string, center?: unknown) => number;
}
declare module "bpmn-js/lib/Modeler" {
  const Modeler: new (options: { container: HTMLElement }) => {
    importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
    saveXML: (options?: { format?: boolean }) => Promise<{ xml: string }>;
    on: (event: string, callback: () => void) => void;
    get: (service: string) => BpmnCanvas;
    destroy: () => void;
  };
  export default Modeler;
}
declare module "bpmn-js/lib/NavigatedViewer" {
  const NavigatedViewer: new (options: { container: HTMLElement }) => {
    importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
    get: (service: string) => BpmnCanvas;
    destroy: () => void;
  };
  export default NavigatedViewer;
}
declare module "bpmn-auto-layout" {
  export function layoutProcess(xml: string): Promise<string>;
}
