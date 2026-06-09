import type { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import type { SchemaIR } from "../../types/schema";

const TOP_LEVEL_KEYWORDS: Completion[] = [
  { label: "Table", type: "keyword", detail: "define a table" },
  { label: "Ref", type: "keyword", detail: "define a relationship" },
  { label: "Enum", type: "keyword", detail: "define an enum" },
  { label: "TableGroup", type: "keyword", detail: "group tables" },
  { label: "Project", type: "keyword", detail: "project settings" },
  { label: "Note", type: "keyword", detail: "standalone note" },
];

const COLUMN_TYPES: Completion[] = [
  "integer", "int", "smallint", "bigint", "serial", "bigserial",
  "varchar", "char", "text",
  "boolean", "bool",
  "decimal", "numeric", "real", "float",
  "date", "time", "timestamp", "timestamptz",
  "uuid", "json", "jsonb", "xml", "bytea", "money",
].map((t) => ({ label: t, type: "type" }));

const SETTINGS_KEYWORDS: Completion[] = [
  { label: "pk", type: "keyword", detail: "primary key" },
  { label: "primary key", type: "keyword" },
  { label: "increment", type: "keyword", detail: "auto increment" },
  { label: "unique", type: "keyword" },
  { label: "not null", type: "keyword" },
  { label: "null", type: "keyword" },
  { label: "default:", type: "keyword", detail: "default value" },
  { label: "ref:", type: "keyword", detail: "inline reference" },
  { label: "note:", type: "keyword", detail: "column note" },
];

export function createDbmlCompletion(
  schemaRef: React.MutableRefObject<SchemaIR | null>
) {
  return function dbmlCompletion(
    context: CompletionContext
  ): CompletionResult | null {
    const line = context.state.doc.lineAt(context.pos);
    const textBefore = line.text.slice(0, context.pos - line.from);

    if (/^\[/.test(textBefore) || /,\s*$/.test(textBefore) || /\[\s*\w*$/.test(textBefore)) {
      const word = context.matchBefore(/\w*/);
      if (!word) return null;
      return {
        from: word.from,
        options: SETTINGS_KEYWORDS,
        validFor: /^\w*$/,
      };
    }

    if (/^Ref[:\s]/.test(textBefore) || /ref:\s*[<>-]*\s*\w*\.?\w*$/.test(textBefore)) {
      const schema = schemaRef.current;
      if (!schema) return null;

      const dotMatch = textBefore.match(/(\w+)\.(\w*)$/);
      if (dotMatch) {
        const tableName = dotMatch[1];
        const table = schema.tables.find((t) => t.name === tableName);
        if (!table) return null;
        const word = context.matchBefore(/\w*/);
        if (!word) return null;
        return {
          from: word.from,
          options: table.columns.map((c) => ({
            label: c.name,
            type: "property",
            detail: c.type,
          })),
          validFor: /^\w*$/,
        };
      }

      const word = context.matchBefore(/\w*/);
      if (!word) return null;
      return {
        from: word.from,
        options: schema.tables.map((t) => ({
          label: t.name,
          type: "class",
        })),
        validFor: /^\w*$/,
      };
    }

    const colTypeMatch = textBefore.match(/^\s+\w+\s+(\w*)$/);
    if (colTypeMatch) {
      const word = context.matchBefore(/\w*/);
      if (!word || word.from === word.to) return null;
      const schema = schemaRef.current;
      const enumOptions = schema
        ? schema.enums.map((e) => ({ label: e.name, type: "enum" as const }))
        : [];
      return {
        from: word.from,
        options: [...COLUMN_TYPES, ...enumOptions],
        validFor: /^\w*$/,
      };
    }

    if (/^\s*$/.test(textBefore) || /^\w*$/.test(textBefore)) {
      const word = context.matchBefore(/\w*/);
      if (!word || word.from === word.to) return null;
      return {
        from: word.from,
        options: TOP_LEVEL_KEYWORDS,
        validFor: /^\w*$/,
      };
    }

    return null;
  };
}
