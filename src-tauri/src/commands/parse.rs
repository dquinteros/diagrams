use crate::parser::convert::{self, ParseError, SchemaIR};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseResult {
    pub schema: Option<SchemaIR>,
    pub error: Option<ParseError>,
}

#[tauri::command]
pub fn parse_dbml(input: String) -> ParseResult {
    match dbml_rs::parse_dbml(&input) {
        Ok(ast) => {
            let schema = convert::convert_schema(&ast);
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
