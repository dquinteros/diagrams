export interface SchemaIR {
  tables: TableIR[];
  refs: RefIR[];
  enums: EnumIR[];
  tableGroups: TableGroupIR[];
  notes: NoteIR[];
  project: ProjectIR | null;
}

export interface NoteIR {
  name: string | null;
  content: string;
  spanRange: [number, number];
}

export interface TableIR {
  name: string;
  schema: string | null;
  alias: string | null;
  columns: ColumnIR[];
  indexes: IndexIR[];
  note: string | null;
  headerColor: string | null;
  spanRange: [number, number];
}

export interface ColumnIR {
  name: string;
  type: string;
  isPk: boolean;
  isUnique: boolean;
  isNullable: boolean;
  isIncremental: boolean;
  defaultValue: string | null;
  note: string | null;
  spanRange: [number, number];
}

export interface RefIR {
  name: string | null;
  relation: "one_to_one" | "one_to_many" | "many_to_one" | "many_to_many";
  fromTable: string;
  fromSchema: string | null;
  fromColumns: string[];
  toTable: string;
  toSchema: string | null;
  toColumns: string[];
  onDelete: string | null;
  onUpdate: string | null;
  spanRange: [number, number];
}

export interface EnumIR {
  name: string;
  schema: string | null;
  values: EnumValueIR[];
  spanRange: [number, number];
}

export interface EnumValueIR {
  name: string;
  note: string | null;
}

export interface IndexIR {
  columns: string[];
  isUnique: boolean;
  isPk: boolean;
  indexType: string | null;
  name: string | null;
}

export interface TableGroupIR {
  name: string;
  tables: string[];
  spanRange: [number, number];
}

export interface ProjectIR {
  name: string;
  note: string | null;
  databaseType: string | null;
}

export interface ParseError {
  message: string;
  span: [number, number] | null;
}

export interface ParseResult {
  schema: SchemaIR | null;
  error: ParseError | null;
}
