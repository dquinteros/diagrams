use crate::parser::convert;
use crate::sql::{self, SqlDialect};

#[tauri::command]
pub fn generate_sql(input: String, dialect: String) -> Result<String, String> {
    let dialect = SqlDialect::from_str(&dialect)
        .ok_or_else(|| format!("Unknown dialect: {}", dialect))?;

    let ast = dbml_rs::parse_dbml(&input)
        .map_err(|e| format!("Parse error: {}", e))?;

    let schema = convert::convert_schema(&ast);
    sql::generate_sql(&schema, &dialect)
}
