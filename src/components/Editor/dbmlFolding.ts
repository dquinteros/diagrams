import { foldService } from "@codemirror/language";

export const dbmlFoldService = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart);
  const text = line.text.trimStart();

  if (!text.includes("{")) return null;

  const openBraceIdx = line.text.indexOf("{");
  if (openBraceIdx < 0) return null;

  let depth = 0;
  let quote: string | null = null; // active string delimiter, or null
  let prev = "";
  for (let pos = lineStart + openBraceIdx; pos < state.doc.length; pos++) {
    const ch = state.doc.sliceString(pos, pos + 1);

    if (quote) {
      // Inside a string: only the matching, unescaped quote ends it.
      if (ch === quote && prev !== "\\") quote = null;
      prev = ch;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      prev = ch;
      continue;
    }

    // Skip a `//` line comment to end-of-line so braces inside it don't count.
    if (ch === "/" && prev === "/") {
      const commentLine = state.doc.lineAt(pos);
      pos = commentLine.to;
      prev = "\n";
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        const closeLine = state.doc.lineAt(pos);
        if (closeLine.number > line.number) {
          return { from: lineStart + openBraceIdx + 1, to: pos };
        }
        return null;
      }
    }
    prev = ch;
  }

  return null;
});
