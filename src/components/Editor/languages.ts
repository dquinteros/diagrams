import type { Extension } from "@codemirror/state";
import { autocompletion } from "@codemirror/autocomplete";
import { dbmlLanguage } from "./dbmlLanguage";
import { dbmlFoldService } from "./dbmlFolding";
import { createDbmlCompletion } from "./dbmlCompletion";
import type { DiagramType } from "../../lib/diagramTypes";
import type { SchemaIR } from "../../types/schema";

/** CodeMirror language/grammar extensions for a given diagram type. */
export function languageExtensionsFor(
  type: DiagramType,
  schemaRef: React.MutableRefObject<SchemaIR | null>
): Extension[] {
  switch (type) {
    case "dbml":
      return [
        dbmlLanguage,
        dbmlFoldService,
        autocompletion({
          override: [createDbmlCompletion(schemaRef)],
          activateOnTyping: true,
        }),
      ];
    default:
      return [];
  }
}
