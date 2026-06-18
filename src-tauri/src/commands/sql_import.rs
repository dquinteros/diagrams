use crate::sql::SqlDialect;
use crate::sql_import;

#[tauri::command]
pub fn import_sql(input: String, dialect: String) -> Result<String, String> {
    let dialect = SqlDialect::from_str(&dialect)
        .ok_or_else(|| format!("Unknown dialect: {}", dialect))?;

    sql_import::import_sql(&input, &dialect)
}
