// Registry of supported diagram types. Each type declares how it is labelled,
// which file extensions map to it, its starter template, and a content sniffer
// used to auto-detect the type when opening a file.

export type DiagramType = "dbml" | "sequence" | "bpmn" | "architecture";

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
    defaultContent: `sequenceDiagram
  participant U as User
  participant A as API
  participant DB as Database

  U->>+A: POST /login
  A->>+DB: SELECT user
  DB-->>-A: row
  A-->>-U: 200 OK + token

  Note over U,A: token stored client-side

  alt invalid credentials
    A-->>U: 401 Unauthorized
  else valid
    A-->>U: 200 OK
  end
`,
    detect: (c) => /^\s*sequenceDiagram\b/m.test(c),
  },
  bpmn: {
    id: "bpmn",
    label: "BPMN",
    fileExts: ["bpmn"],
    defaultExt: "bpmn",
    defaultContent: `# BPMN process. Node kinds: start, end, task, user, service, script, xor, and, event
# Group nodes into swimlanes with: lane "Name"

lane "Customer"
  start  begin  "Order received"
  task   pay    "Pay"

lane "Sales"
  task   check  "Check stock"
  xor    gw     "In stock?"
  task   ship   "Ship order"
  end    done   "Order shipped"
  end    oos    "Out of stock"

begin -> pay
pay -> check
check -> gw
gw -> ship : "yes"
gw -> oos  : "no"
ship -> done
`,
    detect: (c) => /^\s*(start|end|task|user|service|script|xor|and|event)\s+[A-Za-z_]/m.test(c) && /->/.test(c),
  },
  architecture: {
    id: "architecture",
    label: "Architecture",
    fileExts: ["arch"],
    defaultExt: "arch",
    defaultContent: `# Architecture diagram. Node kinds (cloud/infra + C4):
#   service database queue cache gateway storage external user
#   person system container component
# Group nodes into zones with: group "Name" … end
# Connections: a -> b [: "label"]   (add a trailing ~ for async/dashed)

group "AWS Cloud"
  user     customer "Customer"
  gateway  api      "API Gateway"
  service  auth     "Auth Service"
  database db       "Postgres"
  cache    redis    "Redis"
  queue    mq       "SQS"
end

external stripe "Stripe API"

customer -> api    : "HTTPS"
api      -> auth
auth     -> redis
api      -> db
api      -> mq     : "async" ~
api      -> stripe : "REST"
`,
    // Architecture-exclusive kinds (or a group block) together with a flow.
    detect: (c) =>
      (/^\s*group\s+["']/m.test(c) ||
        /^\s*(database|db|queue|mq|cache|gateway|storage|external|person|system|container|component)\s+[A-Za-z_]/im.test(c)) &&
      /->/.test(c),
  },
};

/** Types currently exposed in the UI (new-tab picker). */
export const ENABLED_TYPES: DiagramType[] = ["dbml", "sequence", "bpmn", "architecture"];

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
  if (DIAGRAM_TYPES.sequence.detect(content)) return "sequence";
  if (DIAGRAM_TYPES.architecture.detect(content)) return "architecture";
  if (DIAGRAM_TYPES.bpmn.detect(content)) return "bpmn";
  return "dbml";
}

export function defaultContentFor(type: DiagramType): string {
  return DIAGRAM_TYPES[type].defaultContent;
}
