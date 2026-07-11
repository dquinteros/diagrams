import type { SchemaIR } from "../types/schema";

export function findTableAtOffset(
  schema: SchemaIR,
  offset: number
): string | null {
  for (const table of schema.tables) {
    const [start, end] = table.spanRange;
    // spanRange end is exclusive (from Rust Range), so use a half-open check —
    // otherwise the byte just after a table (or an adjacent table's start)
    // wrongly matches this one.
    if (offset >= start && offset < end) {
      return table.name;
    }
  }
  return null;
}
