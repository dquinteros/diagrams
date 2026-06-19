// Registry of supported diagram types. Each type declares how it is labelled,
// which file extensions map to it, its starter template, and a content sniffer
// used to auto-detect the type when opening a file.

export type DiagramType = "dbml" | "sequence" | "bpmn";

export interface DiagramTypeInfo {
  id: DiagramType;
  label: string;
  fileExts: string[];
  defaultExt: string;
  defaultContent: string;
  /** Heuristic content sniff used when the extension is ambiguous. */
  detect: (content: string) => boolean;
}

const DBML_DEFAULT = `// Welcome to Diagrams — a local DBML editor
// Start typing your schema below

Table users {
  id integer [pk, increment]
  username varchar(50) [unique, not null]
  email varchar(255) [unique, not null]
  role varchar(20) [default: 'user', check: \`role in ('user','admin')\`]
  created_at timestamp [default: \`now()\`]

  Note: 'Stores user accounts'
}

Table posts {
  id integer [pk, increment]
  title varchar(255) [not null]
  body text
  status varchar(20) [default: 'draft']
  user_id integer [not null]
  created_at timestamp [default: \`now()\`]
}

Table comments {
  id integer [pk, increment]
  body text [not null]
  post_id integer [not null]
  user_id integer [not null]
  created_at timestamp [default: \`now()\`]
}

Table tags {
  id integer [pk, increment]
  name varchar(100) [unique, not null]
}

Table post_tags {
  post_id integer [not null]
  tag_id integer [not null]

  indexes {
    (post_id, tag_id) [unique]
  }
}

Ref: posts.user_id > users.id [delete: cascade]
Ref: comments.post_id > posts.id [delete: cascade]
Ref: comments.user_id > users.id
Ref: post_tags.post_id > posts.id [delete: cascade]
Ref: post_tags.tag_id > tags.id [delete: cascade]

Enum post_status {
  draft
  published
  archived
}

Note schema_info {
  'Blog demo schema. Drag tables to rearrange; the layout is saved per file.'
}
`;

export const DIAGRAM_TYPES: Record<DiagramType, DiagramTypeInfo> = {
  dbml: {
    id: "dbml",
    label: "DBML",
    fileExts: ["dbml"],
    defaultExt: "dbml",
    defaultContent: DBML_DEFAULT,
    detect: () => true, // default fallback
  },
  // Registered in later phases:
  sequence: {
    id: "sequence",
    label: "Sequence",
    fileExts: ["seq"],
    defaultExt: "seq",
    defaultContent: "",
    detect: (c) => /^\s*sequenceDiagram\b/m.test(c),
  },
  bpmn: {
    id: "bpmn",
    label: "BPMN",
    fileExts: ["bpmn"],
    defaultExt: "bpmn",
    defaultContent: "",
    detect: (c) => /<\w*:?definitions[\s>]/.test(c) && /bpmn/i.test(c),
  },
};

/** Types currently exposed in the UI (new-tab picker). */
export const ENABLED_TYPES: DiagramType[] = ["dbml"];

export function typeForExtension(ext: string): DiagramType | null {
  const lower = ext.toLowerCase();
  for (const info of Object.values(DIAGRAM_TYPES)) {
    if (info.fileExts.includes(lower)) return info.id;
  }
  return null;
}

/** Detect a document's type from its path (extension) then content. */
export function detectType(filePath: string | null, content: string): DiagramType {
  if (filePath) {
    const ext = filePath.split(".").pop();
    if (ext) {
      const byExt = typeForExtension(ext);
      if (byExt) return byExt;
    }
  }
  // Content sniff, most-specific first.
  if (DIAGRAM_TYPES.bpmn.detect(content)) return "bpmn";
  if (DIAGRAM_TYPES.sequence.detect(content)) return "sequence";
  return "dbml";
}

export function defaultContentFor(type: DiagramType): string {
  return DIAGRAM_TYPES[type].defaultContent;
}
