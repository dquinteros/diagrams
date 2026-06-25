// IR for the Architecture diagram text DSL. Components/services and their
// connections, optionally enclosed in named groups (zones/boundaries).

export type ArchNodeKind =
  // cloud / infra vocabulary
  | "service"
  | "database"
  | "queue"
  | "cache"
  | "gateway"
  | "storage"
  | "external"
  | "user"
  // C4 vocabulary
  | "person"
  | "system"
  | "container"
  | "component";

export interface ArchNode {
  id: string;
  kind: ArchNodeKind;
  label: string;
  /** Group (zone) name this node belongs to, if any. */
  group?: string;
}

export interface ArchEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** Rendered as a dashed connector (e.g. an asynchronous call). */
  async?: boolean;
}

export interface ArchIR {
  nodes: ArchNode[];
  edges: ArchEdge[];
  /** Group names in declaration order (empty when no groups are used). */
  groups: string[];
}

export interface ArchParseError {
  message: string;
  line: number;
}

export interface ArchParseResult {
  ir: ArchIR;
  error: ArchParseError | null;
}

/** Canonical node kinds accepted directly in the DSL. */
export const ARCH_KINDS: ArchNodeKind[] = [
  "service",
  "database",
  "queue",
  "cache",
  "gateway",
  "storage",
  "external",
  "user",
  "person",
  "system",
  "container",
  "component",
];

/** Synonyms normalized to a canonical kind, so both vocabularies feel natural. */
export const ARCH_KIND_ALIASES: Record<string, ArchNodeKind> = {
  db: "database",
  datastore: "database",
  mq: "queue",
  topic: "queue",
  redis: "cache",
  api: "gateway",
  bucket: "storage",
  disk: "storage",
  system_ext: "external",
  externalsystem: "external",
  ext: "external",
  actor: "user",
};

/** Resolve a raw DSL keyword to a canonical kind, or null if unrecognized. */
export function resolveKind(raw: string): ArchNodeKind | null {
  const k = raw.toLowerCase();
  if ((ARCH_KINDS as string[]).includes(k)) return k as ArchNodeKind;
  return ARCH_KIND_ALIASES[k] ?? null;
}
