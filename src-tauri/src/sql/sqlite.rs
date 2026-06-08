use super::SqlGenerator;
use crate::parser::convert::{ColumnIR, IndexIR, RefIR, SchemaIR, TableIR};

pub struct SqliteGenerator;

impl SqlGenerator for SqliteGenerator {
    fn generate(&self, schema: &SchemaIR) -> Result<String, String> {
        let mut out = String::new();

        for table in &schema.tables {
            out.push_str(&generate_table(table, schema));
            out.push('\n');
        }

        for table in &schema.tables {
            for idx in &table.indexes {
                if !idx.is_pk {
                    out.push_str(&generate_index(&table.name, idx));
                    out.push('\n');
                }
            }
        }

        Ok(out.trim_end().to_string())
    }
}

fn generate_table(table: &TableIR, schema: &SchemaIR) -> String {
    let mut lines: Vec<String> = Vec::new();

    for col in &table.columns {
        lines.push(generate_column(col, table, schema));
    }

    let pks: Vec<&str> = table.columns.iter().filter(|c| c.is_pk).map(|c| c.name.as_str()).collect();
    if pks.len() > 1 {
        let pk_cols: Vec<String> = pks.iter().map(|c| format!("\"{}\"", c)).collect();
        lines.push(format!("  PRIMARY KEY ({})", pk_cols.join(", ")));
    }

    let fk_lines: Vec<String> = schema
        .refs
        .iter()
        .filter(|r| r.from_table == table.name)
        .map(|r| generate_inline_fk(r))
        .collect();
    lines.extend(fk_lines);

    format!(
        "CREATE TABLE \"{}\" (\n{}\n);\n",
        table.name,
        lines.join(",\n")
    )
}

fn generate_column(col: &ColumnIR, table: &TableIR, _schema: &SchemaIR) -> String {
    let mut parts = vec![format!("  \"{}\"", col.name)];

    let col_type = map_type(&col.r#type);
    parts.push(col_type);

    let single_pk = table.columns.iter().filter(|c| c.is_pk).count() == 1;
    if col.is_pk && single_pk {
        parts.push("PRIMARY KEY".to_string());
        if col.is_incremental {
            parts.push("AUTOINCREMENT".to_string());
        }
    }

    if !col.is_nullable && !col.is_pk {
        parts.push("NOT NULL".to_string());
    }

    if col.is_unique {
        parts.push("UNIQUE".to_string());
    }

    if let Some(ref default) = col.default_value {
        parts.push(format!("DEFAULT {}", default));
    }

    parts.join(" ")
}

fn map_type(raw: &str) -> String {
    match raw.to_lowercase().as_str() {
        "serial" | "smallserial" | "bigserial" => "INTEGER".to_string(),
        "varchar" => "TEXT".to_string(),
        "boolean" | "bool" => "INTEGER".to_string(),
        "timestamp" | "timestamptz" => "TEXT".to_string(),
        "json" | "jsonb" => "TEXT".to_string(),
        "uuid" => "TEXT".to_string(),
        "bytea" => "BLOB".to_string(),
        "decimal" | "numeric" | "money" => "REAL".to_string(),
        "smallint" | "int2" => "INTEGER".to_string(),
        "bigint" | "int8" => "INTEGER".to_string(),
        "real" | "float4" | "double precision" | "float8" => "REAL".to_string(),
        _ => raw.to_string(),
    }
}

fn generate_inline_fk(r: &RefIR) -> String {
    let from_cols: Vec<String> = r.from_columns.iter().map(|c| format!("\"{}\"", c)).collect();
    let to_cols: Vec<String> = r.to_columns.iter().map(|c| format!("\"{}\"", c)).collect();

    let mut fk = format!(
        "  FOREIGN KEY ({}) REFERENCES \"{}\" ({})",
        from_cols.join(", "),
        r.to_table,
        to_cols.join(", ")
    );

    if let Some(ref on_delete) = r.on_delete {
        fk.push_str(&format!(" ON DELETE {}", action_to_sql(on_delete)));
    }
    if let Some(ref on_update) = r.on_update {
        fk.push_str(&format!(" ON UPDATE {}", action_to_sql(on_update)));
    }

    fk
}

fn action_to_sql(action: &str) -> &str {
    match action {
        "cascade" => "CASCADE",
        "restrict" => "RESTRICT",
        "set_null" => "SET NULL",
        "set_default" => "SET DEFAULT",
        "no_action" => "NO ACTION",
        _ => "NO ACTION",
    }
}

fn generate_index(table_name: &str, idx: &IndexIR) -> String {
    let unique = if idx.is_unique { "UNIQUE " } else { "" };
    let idx_name = idx
        .name
        .clone()
        .unwrap_or_else(|| format!("idx_{}_{}", table_name, idx.columns.join("_")));
    let cols: Vec<String> = idx.columns.iter().map(|c| format!("\"{}\"", c)).collect();

    format!(
        "CREATE {}INDEX \"{}\" ON \"{}\" ({});\n",
        unique, idx_name, table_name, cols.join(", ")
    )
}
