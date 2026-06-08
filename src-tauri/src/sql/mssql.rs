use super::SqlGenerator;
use crate::parser::convert::{ColumnIR, IndexIR, RefIR, SchemaIR, TableIR};

pub struct MssqlGenerator;

impl SqlGenerator for MssqlGenerator {
    fn generate(&self, schema: &SchemaIR) -> Result<String, String> {
        let mut out = String::new();

        for table in &schema.tables {
            out.push_str(&generate_table(table, schema));
            out.push_str("GO\n\n");
        }

        for r in &schema.refs {
            out.push_str(&generate_ref(r));
            out.push_str("GO\n\n");
        }

        for table in &schema.tables {
            for idx in &table.indexes {
                if !idx.is_pk {
                    out.push_str(&generate_index(&table.name, idx));
                    out.push_str("GO\n\n");
                }
            }
        }

        Ok(out.trim_end().to_string())
    }
}

fn generate_table(table: &TableIR, schema: &SchemaIR) -> String {
    let qualified = qualified_name(table.schema.as_deref(), &table.name);
    let mut lines: Vec<String> = Vec::new();

    for col in &table.columns {
        lines.push(generate_column(col, schema));
    }

    let pks: Vec<String> = table
        .columns
        .iter()
        .filter(|c| c.is_pk)
        .map(|c| format!("[{}]", c.name))
        .collect();

    if !pks.is_empty() {
        lines.push(format!("  PRIMARY KEY ({})", pks.join(", ")));
    }

    format!(
        "CREATE TABLE {} (\n{}\n);\n",
        qualified,
        lines.join(",\n")
    )
}

fn generate_column(col: &ColumnIR, _schema: &SchemaIR) -> String {
    let mut parts = vec![format!("  [{}]", col.name)];

    let col_type = map_type(&col.r#type);
    parts.push(col_type);

    if col.is_incremental {
        parts.push("IDENTITY(1,1)".to_string());
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
        "serial" | "smallserial" | "bigserial" => "INT".to_string(),
        "text" => "NVARCHAR(MAX)".to_string(),
        "boolean" | "bool" => "BIT".to_string(),
        "timestamp" | "timestamptz" => "DATETIME2".to_string(),
        "json" | "jsonb" => "NVARCHAR(MAX)".to_string(),
        "uuid" => "UNIQUEIDENTIFIER".to_string(),
        "bytea" => "VARBINARY(MAX)".to_string(),
        "varchar" => "NVARCHAR(255)".to_string(),
        "real" | "float4" => "REAL".to_string(),
        "double precision" | "float8" => "FLOAT".to_string(),
        "smallint" | "int2" => "SMALLINT".to_string(),
        "bigint" | "int8" => "BIGINT".to_string(),
        _ => raw.to_string(),
    }
}

fn generate_ref(r: &RefIR) -> String {
    let from = qualified_name(r.from_schema.as_deref(), &r.from_table);
    let to = qualified_name(r.to_schema.as_deref(), &r.to_table);
    let from_cols: Vec<String> = r.from_columns.iter().map(|c| format!("[{}]", c)).collect();
    let to_cols: Vec<String> = r.to_columns.iter().map(|c| format!("[{}]", c)).collect();

    let mut actions = String::new();
    if let Some(ref on_delete) = r.on_delete {
        actions.push_str(&format!(" ON DELETE {}", action_to_sql(on_delete)));
    }
    if let Some(ref on_update) = r.on_update {
        actions.push_str(&format!(" ON UPDATE {}", action_to_sql(on_update)));
    }

    format!(
        "ALTER TABLE {} ADD FOREIGN KEY ({}) REFERENCES {} ({}){};\n",
        from,
        from_cols.join(", "),
        to,
        to_cols.join(", "),
        actions
    )
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
    let cols: Vec<String> = idx.columns.iter().map(|c| format!("[{}]", c)).collect();

    format!(
        "CREATE {}INDEX [{}] ON [{}] ({});\n",
        unique, idx_name, table_name, cols.join(", ")
    )
}

fn qualified_name(schema: Option<&str>, name: &str) -> String {
    match schema {
        Some(s) => format!("[{}].[{}]", s, name),
        None => format!("[dbo].[{}]", name),
    }
}
