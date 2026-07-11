import { StreamLanguage, StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { ARCH_KINDS, ARCH_KIND_ALIASES } from "../../lib/architecture/types";

const KEYWORDS = new Set<string>([
  ...ARCH_KINDS,
  ...Object.keys(ARCH_KIND_ALIASES),
  "group",
  "end",
]);

interface ArchState {
  sawWord: boolean;
}

function tokenize(stream: StringStream, state: ArchState): string | null {
  if (stream.sol()) state.sawWord = false;
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
    state.sawWord = true;
    return "string";
  }

  if (stream.match("->") || stream.eat(":") || stream.eat("~")) {
    state.sawWord = true;
    return "operator";
  }

  if (stream.match(/^[A-Za-z_][\w-]*/)) {
    const word = stream.current().toLowerCase();
    // Only the first word of a node/group line is a keyword (independent of indent).
    const isFirst = !state.sawWord;
    state.sawWord = true;
    if (KEYWORDS.has(word) && isFirst) return "keyword";
    return "variableName";
  }

  stream.next();
  return null;
}

export const architectureLanguage = StreamLanguage.define<ArchState>({
  startState: () => ({ sawWord: false }),
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
