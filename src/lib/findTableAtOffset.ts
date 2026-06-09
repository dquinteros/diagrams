import type { SchemaIR } from "../types/schema";

export function findTableAtOffset(
  schema: SchemaIR,
  offset: number
): string | null {
  for (const table of schema.tables) {
    const [start, end] = table.spanRange;
    if (offset >= start && offset <= end) {
      return table.name;
    }
  }
  return null;
}
