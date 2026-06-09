import { foldService } from "@codemirror/language";

export const dbmlFoldService = foldService.of((state, lineStart, lineEnd) => {
  const line = state.doc.lineAt(lineStart);
  const text = line.text.trimStart();

  if (!text.includes("{")) return null;

  const openBraceIdx = line.text.indexOf("{");
  if (openBraceIdx < 0) return null;

  let depth = 0;
  for (let pos = lineStart + openBraceIdx; pos < state.doc.length; pos++) {
    const ch = state.doc.sliceString(pos, pos + 1);
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
  }

  return null;
});
