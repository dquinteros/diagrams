use crate::parser::convert::{self, ParseError, SchemaIR};
use crate::parser::preprocess;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseResult {
    pub schema: Option<SchemaIR>,
    pub error: Option<ParseError>,
}

fn parse_dbml_sync(input: &str) -> ParseResult {
    let (cleaned, sticky_notes) = preprocess::preprocess(input);
    match dbml_rs::parse_dbml(&cleaned) {
        Ok(ast) => {
            let mut schema = convert::convert_schema(&ast);
            schema.notes.extend(sticky_notes);
            ParseResult {
                schema: Some(schema),
                error: None,
            }
        }
        Err(e) => {
            let span = match e.location {
                pest::error::InputLocation::Pos(p) => Some((p, p)),
                pest::error::InputLocation::Span((s, end)) => Some((s, end)),
            };
            ParseResult {
                schema: None,
                error: Some(ParseError {
                    message: e.to_string(),
                    span,
                }),
            }
        }
    }
}

// Async + spawn_blocking: dbml-rs is superlinear (~600ms at 1000 tables), so
// the parse runs on the blocking pool instead of stalling other IPC commands
// (file ops, window close) behind it.
#[tauri::command]
pub async fn parse_dbml(input: String) -> ParseResult {
    tauri::async_runtime::spawn_blocking(move || parse_dbml_sync(&input))
        .await
        .unwrap_or_else(|e| ParseResult {
            schema: None,
            error: Some(ParseError {
                message: format!("parse task failed: {e}"),
                span: None,
            }),
        })
}
