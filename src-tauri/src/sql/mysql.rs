use super::SqlGenerator;
use crate::parser::convert::{ColumnIR, IndexIR, RefIR, SchemaIR, TableIR};

pub struct MysqlGenerator;

impl SqlGenerator for MysqlGenerator {
    fn generate(&self, schema: &SchemaIR) -> Result<String, String> {
        let mut out = String::new();

        for table in &schema.tables {
            out.push_str(&generate_table(table, schema));
            out.push('\n');
        }

        for r in &schema.refs {
            out.push_str(&generate_ref(r));
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
        lines.push(generate_column(col, schema));
    }

    let pks: Vec<String> = table
        .columns
        .iter()
        .filter(|c| c.is_pk)
        .map(|c| format!("`{}`", c.name))
        .collect();

    if !pks.is_empty() {
        lines.push(format!("  PRIMARY KEY ({})", pks.join(", ")));
    }

    format!(
        "CREATE TABLE `{}` (\n{}\n) ENGINE=InnoDB;\n",
        table.name,
        lines.join(",\n")
    )
}

fn generate_column(col: &ColumnIR, schema: &SchemaIR) -> String {
    let mut parts = vec![format!("  `{}`", col.name)];

    let col_type = map_type(&col.r#type, col.is_incremental, schema);
    parts.push(col_type);

    if !col.is_nullable && !col.is_pk {
        parts.push("NOT NULL".to_string());
    }

    if col.is_incremental {
        parts.push("AUTO_INCREMENT".to_string());
    }

    if col.is_unique {
        parts.push("UNIQUE".to_string());
    }

    if let Some(ref default) = col.default_value {
        parts.push(format!("DEFAULT {}", default));
    }

    parts.join(" ")
}

fn map_type(raw: &str, _is_incremental: bool, schema: &SchemaIR) -> String {
    let is_enum = schema.enums.iter().any(|e| e.name == raw);
    if is_enum {
        let e = schema.enums.iter().find(|e| e.name == raw).unwrap();
        let values: Vec<String> = e.values.iter().map(|v| format!("'{}'", v.name)).collect();
        return format!("ENUM({})", values.join(", "));
    }

    match raw.to_lowercase().as_str() {
        "serial" | "smallserial" | "bigserial" => "INT".to_string(),
        "text" => "TEXT".to_string(),
        "boolean" | "bool" => "TINYINT(1)".to_string(),
        "timestamp" | "timestamptz" => "DATETIME".to_string(),
        "json" | "jsonb" => "JSON".to_string(),
        "uuid" => "CHAR(36)".to_string(),
        "bytea" => "BLOB".to_string(),
        _ => raw.to_string(),
    }
}

fn generate_ref(r: &RefIR) -> String {
    let mut actions = String::new();
    if let Some(ref on_delete) = r.on_delete {
        actions.push_str(&format!(" ON DELETE {}", action_to_sql(on_delete)));
    }
    if let Some(ref on_update) = r.on_update {
        actions.push_str(&format!(" ON UPDATE {}", action_to_sql(on_update)));
    }

    let from_cols: Vec<String> = r.from_columns.iter().map(|c| format!("`{}`", c)).collect();
    let to_cols: Vec<String> = r.to_columns.iter().map(|c| format!("`{}`", c)).collect();

    format!(
        "ALTER TABLE `{}` ADD FOREIGN KEY ({}) REFERENCES `{}` ({}){};\n",
        r.from_table,
        from_cols.join(", "),
        r.to_table,
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
    let cols: Vec<String> = idx.columns.iter().map(|c| format!("`{}`", c)).collect();

    format!(
        "CREATE {}INDEX `{}` ON `{}` ({});\n",
        unique,
        idx_name,
        table_name,
        cols.join(", ")
    )
}
