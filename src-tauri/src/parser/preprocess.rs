//! Text pre-processing applied before handing source to `dbml-rs`.
//!
//! `dbml-rs` (v1.0.1) does not support some DBML constructs that dbdiagram.io
//! does. We extract/strip those here, returning a cleaned string that the
//! upstream parser accepts plus the extracted data, then merge it back into the
//! `SchemaIR`.
//!
//! Replacements are **length-preserving** (matched spans are blanked with
//! spaces, newlines kept) so every offset/`span_range` in the cleaned text
//! still maps to the original source — the editor cursor sync keeps working.

use crate::parser::convert::{unquote, NoteIR};
use regex::Regex;
use std::sync::OnceLock;

/// Named sticky-note blocks: `Note <name> { '...' }`.
/// dbml-rs only accepts the anonymous `Note { '...' }` form, so we lift the
/// named form out entirely and feed it back as `NoteIR` with a title.
fn named_note_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r#"(?is)\bNote\s+([A-Za-z_]\w*)\s*\{\s*('''.*?'''|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\}"#,
        )
        .expect("valid regex")
    })
}

/// Blank a byte range in-place, preserving length and newlines.
fn blank_range(buf: &mut Vec<u8>, start: usize, end: usize) {
    for b in &mut buf[start..end] {
        if *b != b'\n' && *b != b'\r' {
            *b = b' ';
        }
    }
}

/// Extract named sticky notes and return `(cleaned_source, notes)`.
pub fn extract_sticky_notes(input: &str) -> (String, Vec<NoteIR>) {
    let re = named_note_re();
    let mut notes = Vec::new();
    let mut buf = input.as_bytes().to_vec();

    for caps in re.captures_iter(input) {
        let whole = caps.get(0).unwrap();
        let name = caps.get(1).map(|m| m.as_str().to_string());
        let content = caps.get(2).map(|m| unquote(m.as_str())).unwrap_or_default();
        notes.push(NoteIR {
            name,
            content,
            span_range: (whole.start(), whole.end()),
        });
        blank_range(&mut buf, whole.start(), whole.end());
    }

    let cleaned = String::from_utf8(buf).unwrap_or_else(|_| input.to_string());
    (cleaned, notes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_named_note_and_preserves_length() {
        let input = "Note hello {\n  'world'\n}\nTable t { id int }";
        let (cleaned, notes) = extract_sticky_notes(input);
        assert_eq!(cleaned.len(), input.len());
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].name.as_deref(), Some("hello"));
        assert_eq!(notes[0].content, "world");
        // The Table must survive untouched.
        assert!(cleaned.contains("Table t { id int }"));
        // The note text is blanked, newlines kept.
        assert!(cleaned.contains("Table t"));
        assert_eq!(cleaned.matches('\n').count(), input.matches('\n').count());
    }

    #[test]
    fn cleaned_output_parses_with_dbml_rs() {
        let input = "Note n { 'hi' }\nTable users {\n  id int [pk]\n}";
        let (cleaned, notes) = extract_sticky_notes(input);
        assert_eq!(notes.len(), 1);
        let ast = dbml_rs::parse_dbml(&cleaned).expect("cleaned must parse");
        assert_eq!(ast.tables().len(), 1);
    }

    #[test]
    fn ignores_inline_note_setting() {
        let input = "Table t {\n  id int [note: 'a column note']\n}";
        let (cleaned, notes) = extract_sticky_notes(input);
        assert_eq!(notes.len(), 0);
        assert_eq!(cleaned, input);
    }
}
