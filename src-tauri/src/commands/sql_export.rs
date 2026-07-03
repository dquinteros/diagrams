use crate::parser::{convert, preprocess};
use crate::sql::{self, SqlDialect};

#[tauri::command]
pub fn generate_sql(input: String, dialect: String) -> Result<String, String> {
    let dialect = SqlDialect::from_str(&dialect)
        .ok_or_else(|| format!("Unknown dialect: {}", dialect))?;

    // Run the same preprocessing as `parse_dbml` so schemas using named sticky
    // notes, table-level `check:` or `TablePartial` export instead of failing.
    let (cleaned, _sticky_notes) = preprocess::preprocess(&input);
    let ast = dbml_rs::parse_dbml(&cleaned)
        .map_err(|e| format!("Parse error: {}", e))?;

    let schema = convert::convert_schema(&ast);
    sql::generate_sql(&schema, &dialect)
}
