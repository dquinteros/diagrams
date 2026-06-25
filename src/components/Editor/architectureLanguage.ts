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
  afterColon: boolean;
}

function tokenize(stream: StringStream, state: ArchState): string | null {
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

  if (stream.match("->") || stream.eat(":") || stream.eat("~")) {
    return "operator";
  }

  if (stream.match(/^[A-Za-z_][\w-]*/)) {
    const word = stream.current().toLowerCase();
    // Only the first word of a node/group line is a keyword.
    if (KEYWORDS.has(word) && stream.column() <= word.length + 2) return "keyword";
    return "variableName";
  }

  stream.next();
  return null;
}

export const architectureLanguage = StreamLanguage.define<ArchState>({
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
