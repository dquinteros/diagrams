import { StreamLanguage, StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const KEYWORDS = new Set([
  "table",
  "tablepartial",
  "ref",
  "enum",
  "indexes",
  "project",
  "tablegroup",
  "note",
  "check",
  "as",
  "null",
  "not",
  "pk",
  "primary",
  "key",
  "unique",
  "increment",
  "default",
  "type",
  "name",
  "headercolor",
  "delete",
  "update",
  "cascade",
  "restrict",
  "set",
  "no",
  "action",
  "btree",
  "hash",
  "database_type",
]);

const TYPES = new Set([
  "integer",
  "int",
  "smallint",
  "bigint",
  "real",
  "float",
  "double",
  "decimal",
  "numeric",
  "varchar",
  "char",
  "text",
  "boolean",
  "bool",
  "date",
  "time",
  "timestamp",
  "timestamptz",
  "uuid",
  "json",
  "jsonb",
  "serial",
  "bigserial",
  "smallserial",
  "bytea",
  "xml",
  "money",
  "inet",
  "cidr",
  "macaddr",
  "bit",
  "varbit",
  "point",
  "line",
  "polygon",
  "circle",
  "box",
  "path",
  "tsvector",
  "tsquery",
]);

interface DbmlState {
  inBlock: boolean;
  inString: false | "'" | '"';
  inBacktick: boolean;
  inTriple: boolean;
}

// Consume up to and including a closing `'''`, or the rest of the line if the
// triple-quoted string continues. Returns whether the string was closed.
function consumeTriple(stream: StringStream): boolean {
  while (!stream.eol()) {
    if (stream.match("'''")) return true;
    stream.next();
  }
  return false;
}

function tokenize(stream: StringStream, state: DbmlState): string | null {
  if (state.inTriple) {
    state.inTriple = !consumeTriple(stream);
    return "string";
  }

  if (state.inBacktick) {
    if (stream.match(/^[^`]*/)) {
      /* consume */
    }
    if (stream.eat("`")) {
      state.inBacktick = false;
    }
    return "string-2";
  }

  if (state.inString) {
    const quote = state.inString;
    const pattern = quote === "'" ? /^[^']*/ : /^[^"]*/;
    stream.match(pattern);
    if (stream.eat(quote)) {
      state.inString = false;
    }
    return "string";
  }

  if (stream.match("//")) {
    stream.skipToEnd();
    return "comment";
  }

  if (stream.eat("`")) {
    state.inBacktick = true;
    return "string-2";
  }

  // Triple-quoted multi-line string (DBML `'''…'''`) — must be tested before the
  // single-quote case so the three delimiters aren't split into separate tokens.
  if (stream.match("'''")) {
    state.inTriple = !consumeTriple(stream);
    return "string";
  }

  if (stream.eat("'")) {
    state.inString = "'";
    return "string";
  }

  if (stream.eat('"')) {
    state.inString = '"';
    return "string";
  }

  if (stream.match(/^<>/) || stream.match(/^[<>-]/)) {
    return "operator";
  }

  if (stream.match(/^[{}[\](),.:]/)) {
    return "bracket";
  }

  if (stream.match(/^[0-9]+(\.[0-9]+)?/)) {
    return "number";
  }

  if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
    const word = stream.current().toLowerCase();
    if (KEYWORDS.has(word)) return "keyword";
    if (TYPES.has(word)) return "typeName";
    return "variableName";
  }

  stream.next();
  return null;
}

export const dbmlLanguage = StreamLanguage.define<DbmlState>({
  startState: () => ({
    inBlock: false,
    inString: false,
    inBacktick: false,
    inTriple: false,
  }),
  token: tokenize,
  languageData: {
    commentTokens: { line: "//" },
  },
  // Map our token names to highlight tags so a HighlightStyle can color them.
  tokenTable: {
    keyword: tags.keyword,
    string: tags.string,
    "string-2": tags.special(tags.string),
    comment: tags.lineComment,
    number: tags.number,
    operator: tags.operator,
    bracket: tags.punctuation,
    typeName: tags.typeName,
    variableName: tags.variableName,
  },
});
