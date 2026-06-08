import { useRef, useEffect, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { linter, type Diagnostic } from "@codemirror/lint";
import { dbmlLanguage } from "./dbmlLanguage";
import type { ParseError } from "../../types/schema";

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: "#1e1e2e",
  },
  ".cm-content": {
    caretColor: "#f5e0dc",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  ".cm-cursor": {
    borderLeftColor: "#f5e0dc",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "#45475a",
  },
  ".cm-gutters": {
    backgroundColor: "#181825",
    color: "#6c7086",
    border: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "#181825",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#181825",
  },
  ".cm-matchingBracket": {
    backgroundColor: "#45475a",
    outline: "1px solid #585b70",
  },
  ".cm-line": {
    padding: "0 4px",
  },
  ".cm-tooltip": {
    backgroundColor: "#313244",
    border: "1px solid #45475a",
    color: "#cdd6f4",
  },
  ".cm-diagnostic-error": {
    borderBottom: "2px solid #f38ba8",
  },
});

const syntaxHighlighting = EditorView.theme({
  ".ͼb": { color: "#cba6f7" },       // keyword
  ".ͼd": { color: "#a6e3a1" },       // string
  ".ͼi": { color: "#a6e3a1" },       // string-2 (backtick expressions)
  ".ͼe": { color: "#fab387" },       // number
  ".ͼc": { color: "#6c7086" },       // comment
  ".ͼ7": { color: "#89b4fa" },       // operator
  ".ͼ8": { color: "#585b70" },       // bracket
  ".ͼf": { color: "#f9e2af" },       // typeName
  ".ͼ9": { color: "#cdd6f4" },       // variableName
});

interface DbmlEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  parseError: ParseError | null;
}

export function DbmlEditor({ initialValue, onChange, parseError }: DbmlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const errorLinter = useCallback(() => {
    return linter((view) => {
      if (!parseError?.span) return [];
      const doc = view.state.doc;
      const [from, to] = parseError.span;
      const safeFrom = Math.min(from, doc.length);
      const safeTo = Math.min(Math.max(to, safeFrom + 1), doc.length);

      const diagnostic: Diagnostic = {
        from: safeFrom,
        to: safeTo,
        severity: "error",
        message: parseError.message,
      };
      return [diagnostic];
    });
  }, [parseError]);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        dbmlLanguage,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
        ]),
        theme,
        syntaxHighlighting,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflow: "hidden" }}
    />
  );
}
