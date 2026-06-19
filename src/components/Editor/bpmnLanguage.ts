import { StreamLanguage, StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const KEYWORDS = new Set([
  "start",
  "end",
  "task",
  "user",
  "service",
  "script",
  "xor",
  "and",
  "event",
]);

interface BpmnState {
  afterColon: boolean;
}

function tokenize(stream: StringStream, state: BpmnState): string | null {
  if (stream.sol()) state.afterColon = false;
  if (stream.eatSpace()) return null;

  if (stream.match("#") || stream.match("//")) {
    stream.skipToEnd();
    return "comment";
  }

  if (stream.match('"') || stream.match("'")) {
    const quote = stream.string[stream.pos - 1];
    while (!stream.eol()) {
      if (stream.next() === quote) break;
    }
    return "string";
  }

  if (stream.match("->") || stream.eat(":")) {
    return "operator";
  }

  if (stream.match(/^[A-Za-z_][\w-]*/)) {
    const word = stream.current().toLowerCase();
    // Only the first word of a node line is a keyword.
    if (KEYWORDS.has(word) && stream.column() <= word.length + 2) return "keyword";
    return "variableName";
  }

  stream.next();
  return null;
}

export const bpmnLanguage = StreamLanguage.define<BpmnState>({
  startState: () => ({ afterColon: false }),
  token: tokenize,
  languageData: { commentTokens: { line: "#" } },
  tokenTable: {
    keyword: tags.keyword,
    operator: tags.operator,
    string: tags.string,
    comment: tags.lineComment,
    variableName: tags.variableName,
  },
});
