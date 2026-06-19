// bpmn-js ships no TypeScript declarations; expose the deep entry as `any`.
declare module "bpmn-js/lib/Modeler" {
  const Modeler: new (options: { container: HTMLElement }) => {
    importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
    saveXML: (options?: { format?: boolean }) => Promise<{ xml: string }>;
    on: (event: string, callback: () => void) => void;
    get: (service: string) => { zoom: (mode: string) => void };
    destroy: () => void;
  };
  export default Modeler;
}
