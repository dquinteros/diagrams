import { useRef, useEffect, useCallback } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { linter, type Diagnostic } from "@codemirror/lint";
import { dbmlLanguage } from "./dbmlLanguage";
import type { ParseError } from "../../types/schema";
import { useTheme } from "../../context/ThemeContext";
import type { Theme } from "../../lib/themes";

function buildEditorTheme(t: Theme) {
  return EditorView.theme({
    "&": { height: "100%", fontSize: "14px", backgroundColor: t.editorBg },
    ".cm-content": {
      caretColor: t.editorCaret,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    },
    ".cm-cursor": { borderLeftColor: t.editorCaret },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: t.editorSelection,
    },
    ".cm-gutters": { backgroundColor: t.editorGutterBg, color: t.editorGutterText, border: "none" },
    ".cm-activeLine": { backgroundColor: t.editorActiveLine },
    ".cm-activeLineGutter": { backgroundColor: t.editorActiveLine },
    ".cm-matchingBracket": {
      backgroundColor: t.editorMatchBracket,
      outline: `1px solid ${t.editorMatchBracketBorder}`,
    },
    ".cm-line": { padding: "0 4px" },
    ".cm-tooltip": {
      backgroundColor: t.tableHeader,
      border: `1px solid ${t.controlBorder}`,
      color: t.toolbarText,
    },
    ".cm-diagnostic-error": { borderBottom: `2px solid ${t.errorText}` },
  });
}

function buildSyntaxTheme(t: Theme) {
  return EditorView.theme({
    ".ͼb": { color: t.syntaxKeyword },
    ".ͼd": { color: t.syntaxString },
    ".ͼi": { color: t.syntaxString },
    ".ͼe": { color: t.syntaxNumber },
    ".ͼc": { color: t.syntaxComment },
    ".ͼ7": { color: t.syntaxOperator },
    ".ͼ8": { color: t.syntaxBracket },
    ".ͼf": { color: t.syntaxType },
    ".ͼ9": { color: t.syntaxVariable },
  });
}

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
  const { theme } = useTheme();
  const themeCompartment = useRef(new Compartment());
  const syntaxCompartment = useRef(new Compartment());

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
        themeCompartment.current.of(buildEditorTheme(theme)),
        syntaxCompartment.current.of(buildSyntaxTheme(theme)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => { view.destroy(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        themeCompartment.current.reconfigure(buildEditorTheme(theme)),
        syntaxCompartment.current.reconfigure(buildSyntaxTheme(theme)),
      ],
    });
  }, [theme]);

  return (
    <div ref={containerRef} style={{ height: "100%", overflow: "hidden" }} />
  );
}
