use super::SqlGenerator;
use crate::parser::convert::{ColumnIR, EnumIR, IndexIR, RefIR, SchemaIR, TableIR};

pub struct PostgresGenerator;

impl SqlGenerator for PostgresGenerator {
    fn generate(&self, schema: &SchemaIR) -> Result<String, String> {
        let mut out = String::new();

        for e in &schema.enums {
            out.push_str(&generate_enum(e));
            out.push('\n');
        }

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
                out.push_str(&generate_index(&table.name, idx));
                out.push('\n');
            }
        }

        Ok(out.trim_end().to_string())
    }
}

fn generate_enum(e: &EnumIR) -> String {
    let qualified = qualified_name(e.schema.as_deref(), &e.name);
    let values: Vec<String> = e.values.iter().map(|v| format!("  '{}'", v.name)).collect();
    format!("CREATE TYPE {} AS ENUM (\n{}\n);\n", qualified, values.join(",\n"))
}

fn generate_table(table: &TableIR, schema: &SchemaIR) -> String {
    let qualified = qualified_name(table.schema.as_deref(), &table.name);
    let mut lines: Vec<String> = Vec::new();

    for col in &table.columns {
        lines.push(generate_column(col, schema));
    }

    let pks: Vec<&str> = table
        .columns
        .iter()
        .filter(|c| c.is_pk)
        .map(|c| c.name.as_str())
        .collect();

    if pks.len() > 1 {
        lines.push(format!("  PRIMARY KEY ({})", pks.join(", ")));
    }

    format!(
        "CREATE TABLE {} (\n{}\n);\n",
        qualified,
        lines.join(",\n")
    )
}

fn generate_column(col: &ColumnIR, schema: &SchemaIR) -> String {
    let mut parts = vec![format!("  \"{}\"", col.name)];

    let col_type = map_type(&col.r#type, col.is_incremental, schema);
    parts.push(col_type);

    if col.is_pk && !col.is_incremental {
        parts.push("PRIMARY KEY".to_string());
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

fn map_type(raw: &str, is_incremental: bool, schema: &SchemaIR) -> String {
    if is_incremental {
        return match raw.to_lowercase().as_str() {
            "bigint" | "int8" => "BIGSERIAL".to_string(),
            "smallint" | "int2" => "SMALLSERIAL".to_string(),
            _ => "SERIAL".to_string(),
        };
    }

    let is_enum = schema.enums.iter().any(|e| e.name == raw);
    if is_enum {
        return format!("\"{}\"", raw);
    }

    raw.to_string()
}

fn generate_ref(r: &RefIR) -> String {
    let from_table = qualified_name(r.from_schema.as_deref(), &r.from_table);
    let to_table = qualified_name(r.to_schema.as_deref(), &r.to_table);
    let from_cols = r.from_columns.join("\", \"");
    let to_cols = r.to_columns.join("\", \"");

    let mut stmt = format!(
        "ALTER TABLE {} ADD FOREIGN KEY (\"{}\") REFERENCES {} (\"{}\"){}",
        from_table,
        from_cols,
        to_table,
        to_cols,
        build_referential_actions(r),
    );
    stmt.push_str(";\n");
    stmt
}

fn build_referential_actions(r: &RefIR) -> String {
    let mut actions = String::new();
    if let Some(ref on_delete) = r.on_delete {
        actions.push_str(&format!(" ON DELETE {}", action_to_sql(on_delete)));
    }
    if let Some(ref on_update) = r.on_update {
        actions.push_str(&format!(" ON UPDATE {}", action_to_sql(on_update)));
    }
    actions
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

    let using = idx
        .index_type
        .as_deref()
        .map(|t| format!(" USING {}", t.to_uppercase()))
        .unwrap_or_default();

    format!(
        "CREATE {}INDEX \"{}\" ON \"{}\"{}({});\n",
        unique,
        idx_name,
        table_name,
        using,
        cols.join(", ")
    )
}

fn qualified_name(schema: Option<&str>, name: &str) -> String {
    match schema {
        Some(s) => format!("\"{}\".\"{}\"", s, name),
        None => format!("\"{}\"", name),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::convert::convert_schema;

    fn parse_and_generate(input: &str) -> String {
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);
        PostgresGenerator.generate(&ir).expect("generation failed")
    }

    #[test]
    fn test_basic_table() {
        let sql = parse_and_generate(
            r#"
Table users {
  id integer [pk, increment]
  email varchar(255) [unique, not null]
  name varchar(100)
}
"#,
        );
        assert!(sql.contains("CREATE TABLE"));
        assert!(sql.contains("SERIAL"));
        assert!(sql.contains("UNIQUE"));
        assert!(sql.contains("NOT NULL"));
    }

    #[test]
    fn test_foreign_key() {
        let sql = parse_and_generate(
            r#"
Table users {
  id integer [pk]
}
Table posts {
  id integer [pk]
  user_id integer [not null]
}
Ref: posts.user_id > users.id [delete: cascade]
"#,
        );
        assert!(sql.contains("ALTER TABLE"));
        assert!(sql.contains("FOREIGN KEY"));
        assert!(sql.contains("ON DELETE CASCADE"));
    }

    #[test]
    fn test_enum() {
        let sql = parse_and_generate(
            r#"
Enum status {
  active
  inactive
}
"#,
        );
        assert!(sql.contains("CREATE TYPE"));
        assert!(sql.contains("AS ENUM"));
        assert!(sql.contains("'active'"));
    }
}
