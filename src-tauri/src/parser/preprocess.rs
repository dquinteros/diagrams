//! Text pre-processing applied before handing source to `dbml-rs`.
//!
//! `dbml-rs` (v1.0.1) does not support some DBML constructs that dbdiagram.io
//! does. We extract/strip those here, returning a cleaned string that the
//! upstream parser accepts plus the extracted data, then merge it back into the
//! `SchemaIR`.
//!
//! Most replacements are **length-preserving** (matched spans are blanked with
//! spaces, newlines kept) so every offset/`span_range` in the cleaned text
//! still maps to the original source — the editor cursor sync keeps working.
//! The one exception is `TablePartial` expansion, which inlines partial bodies
//! and therefore shifts offsets; it only runs when partials are actually used,
//! so the common case stays exact.

use crate::parser::convert::{unquote, NoteIR};
use regex::Regex;
use std::collections::HashMap;
use std::sync::OnceLock;

/// Full preprocessing pipeline run before `dbml_rs::parse_dbml`.
/// Returns the cleaned source plus extracted named sticky notes.
pub fn preprocess(input: &str) -> (String, Vec<NoteIR>) {
    let expanded = expand_table_partials(input);
    let checks_stripped = strip_table_checks(&expanded);
    extract_sticky_notes(&checks_stripped)
}

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

/// Table-level `check: '...'` declarations: dbml-rs rejects them. Blank them so
/// the schema still parses (table-level checks are not rendered).
fn table_check_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?im)^[ \t]*check[ \t]*:[^\n]*").expect("valid regex"))
}

pub fn strip_table_checks(input: &str) -> String {
    let re = table_check_re();
    let mut buf = input.as_bytes().to_vec();
    for m in re.find_iter(input) {
        blank_range(&mut buf, m.start(), m.end());
    }
    String::from_utf8(buf).unwrap_or_else(|_| input.to_string())
}

/// Expand `TablePartial name { ... }` definitions and `~name` injections.
/// dbml-rs has no notion of partials, so we inline them into plain DBML.
/// NOTE: this shifts source offsets; it only runs when partials are present.
pub fn expand_table_partials(input: &str) -> String {
    if !input.contains("TablePartial") && !input.contains('~') {
        return input.to_string();
    }

    let bytes = input.as_bytes();
    let n = bytes.len();
    let mut partials: HashMap<String, String> = HashMap::new();
    let mut without_defs = String::with_capacity(n);
    let mut last = 0;
    let mut i = 0;

    while i < n {
        if input[i..].starts_with("TablePartial") && is_word_start(bytes, i) {
            let mut j = i + "TablePartial".len();
            while j < n && bytes[j].is_ascii_whitespace() {
                j += 1;
            }
            let name_start = j;
            while j < n && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'_') {
                j += 1;
            }
            let name = input[name_start..j].to_string();
            while j < n && bytes[j].is_ascii_whitespace() {
                j += 1;
            }
            if j < n && bytes[j] == b'{' {
                let body_start = j + 1;
                let mut depth = 1;
                let mut k = body_start;
                while k < n && depth > 0 {
                    match bytes[k] {
                        b'{' => depth += 1,
                        b'}' => depth -= 1,
                        _ => {}
                    }
                    k += 1;
                }
                if !name.is_empty() {
                    partials.insert(name, input[body_start..k - 1].trim().to_string());
                }
                without_defs.push_str(&input[last..i]);
                last = k;
                i = k;
                continue;
            }
        }
        i += 1;
    }
    without_defs.push_str(&input[last..]);

    // Inject partial bodies wherever `~name` appears.
    let tilde_re = Regex::new(r"~([A-Za-z_]\w*)").expect("valid regex");
    tilde_re
        .replace_all(&without_defs, |caps: &regex::Captures| {
            partials.get(&caps[1]).cloned().unwrap_or_default()
        })
        .into_owned()
}

fn is_word_start(bytes: &[u8], i: usize) -> bool {
    if i == 0 {
        return true;
    }
    let prev = bytes[i - 1];
    !(prev.is_ascii_alphanumeric() || prev == b'_')
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

    #[test]
    fn expands_table_partial() {
        let input =
            "TablePartial base {\n  id int [pk]\n  created_at timestamp\n}\nTable users {\n  ~base\n  name varchar\n}";
        let expanded = expand_table_partials(input);
        assert!(!expanded.contains("TablePartial"));
        assert!(!expanded.contains("~base"));
        assert!(expanded.contains("id int [pk]"));
        assert!(expanded.contains("created_at timestamp"));
        assert!(expanded.contains("name varchar"));
        // The expanded output must parse and produce the merged columns.
        let ast = dbml_rs::parse_dbml(&expanded).expect("expanded must parse");
        let table = &ast.tables()[0];
        assert_eq!(table.cols.len(), 3);
    }

    #[test]
    fn partial_with_nested_indexes_block() {
        let input = "TablePartial p {\n  a int\n  indexes {\n    a\n  }\n}\nTable t {\n  ~p\n}";
        let expanded = expand_table_partials(input);
        assert!(dbml_rs::parse_dbml(&expanded).is_ok());
    }

    #[test]
    fn strips_table_level_check() {
        let input = "Table t {\n  id int [pk]\n  check: 'id > 0'\n}";
        let stripped = strip_table_checks(input);
        assert_eq!(stripped.len(), input.len());
        assert!(!stripped.contains("check:"));
        assert!(dbml_rs::parse_dbml(&stripped).is_ok());
    }

    #[test]
    fn keeps_inline_column_check() {
        // Inline `[check: ...]` is valid for dbml-rs (lands in attributes) and
        // must NOT be stripped.
        let input = "Table t {\n  id int [check: 'id > 0']\n}";
        let stripped = strip_table_checks(input);
        assert_eq!(stripped, input);
    }
}
