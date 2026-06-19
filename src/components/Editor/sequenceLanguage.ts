import { StreamLanguage, StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const KEYWORDS = new Set([
  "sequencediagram",
  "participant",
  "actor",
  "activate",
  "deactivate",
  "note",
  "over",
  "left",
  "right",
  "of",
  "as",
  "loop",
  "alt",
  "opt",
  "par",
  "critical",
  "break",
  "else",
  "end",
]);

interface SeqState {
  afterColon: boolean;
}

function tokenize(stream: StringStream, state: SeqState): string | null {
  if (stream.sol()) state.afterColon = false;

  if (stream.eatSpace()) return null;

  if (stream.match("//") || stream.match("#")) {
    stream.skipToEnd();
    return "comment";
  }

  // Message text after ':' runs to end of line.
  if (state.afterColon) {
    stream.skipToEnd();
    return "string";
  }

  if (stream.eat(":")) {
    state.afterColon = true;
    return "operator";
  }

  // Arrow operators.
  if (stream.match(/^--?>>?|^--?x|^-x/)) {
    return "operator";
  }
  if (stream.eat("+") || stream.eat("-")) {
    return "operator";
  }

  if (stream.match(/^[A-Za-z_][\w]*/)) {
    const word = stream.current().toLowerCase();
    if (KEYWORDS.has(word)) return "keyword";
    return "variableName";
  }

  stream.next();
  return null;
}

export const sequenceLanguage = StreamLanguage.define<SeqState>({
  startState: () => ({ afterColon: false }),
  token: tokenize,
  languageData: { commentTokens: { line: "//" } },
  tokenTable: {
    keyword: tags.keyword,
    operator: tags.operator,
    string: tags.string,
    comment: tags.lineComment,
    variableName: tags.variableName,
  },
});
