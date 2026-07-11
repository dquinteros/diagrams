// Deterministic synthetic diagram generators for benchmarking.
// "n" is the primary element count per type:
//   dbml:         n tables (6 columns each) + (n-1) refs in a chain
//   sequence:     n messages across 10 participants (+1 note per 25 msgs)
//   bpmn:         n nodes in lanes of 25 + (n-1) chained flows
//   architecture: n nodes in groups of 20 + chained edges + extra cross-links

export type BenchType = "dbml" | "sequence" | "bpmn" | "architecture";

export function genDbml(n: number): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(
      [
        `Table t_${i} {`,
        `  id integer [pk, increment]`,
        `  name varchar(100) [not null]`,
        `  status varchar(20)`,
        `  amount decimal(10,2)`,
        `  parent_id integer`,
        `  created_at timestamp`,
        `}`,
      ].join("\n")
    );
  }
  for (let i = 1; i < n; i++) {
    parts.push(`Ref: t_${i}.parent_id > t_${i - 1}.id`);
  }
  return parts.join("\n\n") + "\n";
}

// SchemaIR mirror of genDbml(n) — used by the browser mock of the Rust parser.
export function genDbmlIR(n: number): unknown {
  const colNames: [string, string][] = [
    ["id", "integer"],
    ["name", "varchar(100)"],
    ["status", "varchar(20)"],
    ["amount", "decimal(10,2)"],
    ["parent_id", "integer"],
    ["created_at", "timestamp"],
  ];
  const tables = [];
  for (let i = 0; i < n; i++) {
    tables.push({
      name: `t_${i}`,
      schema: null,
      alias: null,
      columns: colNames.map(([name, type], j) => ({
        name,
        type,
        isPk: j === 0,
        isUnique: false,
        isNullable: j !== 0 && j !== 1,
        isIncremental: j === 0,
        defaultValue: null,
        note: null,
        check: null,
        spanRange: [0, 10] as [number, number],
      })),
      indexes: [],
      note: null,
      headerColor: null,
      spanRange: [0, 10] as [number, number],
    });
  }
  const refs = [];
  for (let i = 1; i < n; i++) {
    refs.push({
      name: null,
      relation: "many_to_one",
      fromTable: `t_${i}`,
      fromSchema: null,
      fromColumns: ["parent_id"],
      toTable: `t_${i - 1}`,
      toSchema: null,
      toColumns: ["id"],
      onDelete: null,
      onUpdate: null,
      spanRange: [0, 10] as [number, number],
    });
  }
  return { tables, refs, enums: [], tableGroups: [], notes: [], project: null };
}

const SEQ_PARTICIPANTS = 10;

export function genSequence(n: number): string {
  const lines: string[] = ["sequenceDiagram"];
  for (let p = 0; p < SEQ_PARTICIPANTS; p++) {
    lines.push(`  participant P${p} as Service_${p}`);
  }
  for (let i = 0; i < n; i++) {
    const from = i % SEQ_PARTICIPANTS;
    const to = (i + 1) % SEQ_PARTICIPANTS;
    const arrow = i % 3 === 0 ? "->>" : i % 3 === 1 ? "-->>" : "->";
    lines.push(`  P${from} ${arrow} P${to} : call step ${i}`);
    if (i > 0 && i % 25 === 0) {
      lines.push(`  Note over P${from},P${to} : checkpoint ${i}`);
    }
  }
  return lines.join("\n") + "\n";
}

const BPMN_KINDS = ["task", "user", "service", "script", "xor", "event"];

export function genBpmn(n: number): string {
  const lines: string[] = [];
  const perLane = 25;
  for (let i = 0; i < n; i++) {
    if (i % perLane === 0) lines.push(`lane "Lane ${Math.floor(i / perLane)}"`);
    const kind =
      i === 0 ? "start" : i === n - 1 ? "end" : BPMN_KINDS[i % BPMN_KINDS.length];
    lines.push(`  ${kind} n${i} "Step ${i}"`);
  }
  for (let i = 1; i < n; i++) {
    const label = i % 5 === 0 ? ` : "ok"` : "";
    lines.push(`n${i - 1} -> n${i}${label}`);
  }
  return lines.join("\n") + "\n";
}

const ARCH_KINDS = [
  "service",
  "database",
  "queue",
  "cache",
  "gateway",
  "storage",
  "component",
];

export function genArchitecture(n: number): string {
  const lines: string[] = [];
  const perGroup = 20;
  for (let i = 0; i < n; i++) {
    if (i % perGroup === 0) {
      if (i > 0) lines.push("end");
      lines.push(`group "Zone ${Math.floor(i / perGroup)}"`);
    }
    lines.push(`  ${ARCH_KINDS[i % ARCH_KINDS.length]} a${i} "Node ${i}"`);
  }
  lines.push("end");
  for (let i = 1; i < n; i++) {
    lines.push(`a${i - 1} -> a${i}`);
    if (i % 7 === 0 && i >= 14) {
      lines.push(`a${i} -> a${i - 14} : "async" ~`);
    }
  }
  return lines.join("\n") + "\n";
}

export function genContent(type: BenchType, n: number): string {
  switch (type) {
    case "dbml":
      return genDbml(n);
    case "sequence":
      return genSequence(n);
    case "bpmn":
      return genBpmn(n);
    case "architecture":
      return genArchitecture(n);
  }
}
