import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  highlightActiveLine,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  foldGutter,
  codeFolding,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { useTheme } from "../../context/ThemeContext";
import type { Theme } from "../../lib/themes";

function buildEditorTheme(t: Theme) {
  return EditorView.theme({
    "&": { height: "100%", fontSize: "14px", backgroundColor: t.editorBg },
    ".cm-content": {
      caretColor: t.editorCaret,
      color: t.syntaxVariable,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    },
    ".cm-cursor": { borderLeftColor: t.editorCaret },
    // High specificity + !important so CodeMirror's default light selection
    // (#d7d4f0) doesn't win in dark mode.
    "&.cm-focused .cm-selectionBackground, & .cm-selectionBackground, .cm-selectionBackground, & .cm-content ::selection":
      {
        backgroundColor: `${t.editorSelection} !important`,
      },
    ".cm-gutters": {
      backgroundColor: t.editorGutterBg,
      color: t.editorGutterText,
      border: "none",
    },
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
  const highlightStyle = HighlightStyle.define([
    { tag: tags.lineComment, color: t.syntaxComment, fontStyle: "italic" },
    { tag: tags.comment, color: t.syntaxComment, fontStyle: "italic" },
    { tag: tags.keyword, color: t.syntaxKeyword },
    { tag: tags.string, color: t.syntaxString },
    { tag: tags.special(tags.string), color: t.syntaxString },
    { tag: tags.number, color: t.syntaxNumber },
    { tag: tags.operator, color: t.syntaxOperator },
    { tag: tags.punctuation, color: t.syntaxBracket },
    { tag: tags.typeName, color: t.syntaxType },
    { tag: tags.tagName, color: t.syntaxKeyword },
    { tag: tags.attributeName, color: t.syntaxType },
    { tag: tags.variableName, color: t.syntaxVariable },
  ]);
  return syntaxHighlighting(highlightStyle);
}

export interface CodeEditorHandle {
  scrollToOffset: (offset: number) => void;
}

/**
 * A parse error to surface inline. DBML errors carry a char `span`; the
 * client-side parsers (sequence/bpmn/architecture) carry a 1-based `line`.
 */
export interface EditorDiagnostic {
  message: string;
  span?: [number, number] | null;
  line?: number | null;
}

interface CodeEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  onCursorChange?: (offset: number) => void;
  /** Language-specific extensions (grammar, completion, folding) by diagram type. */
  languageExtensions: Extension[];
  /**
   * Authoritative content. When it changes externally (e.g. the BPMN modeler
   * edits the XML), the editor is updated to match. No-op for editor-originated
   * changes since the value already equals the document.
   */
  syncValue?: string;
  /** Active parse error to underline in the editor, or null to clear. */
  diagnostic?: EditorDiagnostic | null;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor({ initialValue, onChange, onCursorChange, languageExtensions, syncValue, diagnostic }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onCursorChangeRef = useRef(onCursorChange);
    onCursorChangeRef.current = onCursorChange;
    const langRef = useRef(languageExtensions);
    const { theme } = useTheme();
    const themeCompartment = useRef(new Compartment());
    const syntaxCompartment = useRef(new Compartment());

    useImperativeHandle(ref, () => ({
      scrollToOffset(offset: number) {
        const view = viewRef.current;
        if (!view) return;
        const safeOffset = Math.max(0, Math.min(offset, view.state.doc.length));
        view.dispatch({
          selection: { anchor: safeOffset },
          effects: EditorView.scrollIntoView(safeOffset, { y: "center" }),
        });
        view.focus();
      },
    }));

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
          codeFolding(),
          foldGutter(),
          ...langRef.current,
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
            if (update.selectionSet) {
              const offset = update.state.selection.main.head;
              onCursorChangeRef.current?.(offset);
            }
          }),
        ],
      });

      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;
      return () => {
        view.destroy();
      };
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

    // Reflect external content changes (e.g. loading a file into the tab).
    useEffect(() => {
      const view = viewRef.current;
      if (!view || syncValue === undefined) return;
      const current = view.state.doc.toString();
      if (syncValue !== current) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: syncValue } });
      }
    }, [syncValue]);

    // Surface the active parse error as an inline red underline + hover tooltip.
    // `setDiagnostics` self-enables the lint extension on first use.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const doc = view.state.doc;
      const diags: Diagnostic[] = [];
      if (diagnostic && doc.length > 0) {
        let from: number;
        let to: number;
        if (diagnostic.span) {
          from = Math.max(0, Math.min(diagnostic.span[0], doc.length));
          to = Math.max(0, Math.min(diagnostic.span[1], doc.length));
        } else {
          const lineNo = Math.min(Math.max(diagnostic.line ?? 1, 1), doc.lines);
          const line = doc.line(lineNo);
          from = line.from;
          to = line.to;
        }
        // A zero-width range renders nothing; widen it to the enclosing line.
        if (to <= from) {
          const line = doc.lineAt(Math.min(from, doc.length));
          from = line.from;
          to = line.to;
        }
        if (to > from) {
          diags.push({ from, to, severity: "error", message: diagnostic.message });
        }
      }
      view.dispatch(setDiagnostics(view.state, diags));
    }, [diagnostic]);

    return (
      <div ref={containerRef} style={{ height: "100%", overflow: "hidden" }} />
    );
  }
);
