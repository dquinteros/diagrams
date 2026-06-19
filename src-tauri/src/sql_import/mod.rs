//! Inverse of the `sql` module: parse SQL DDL (4 dialects) and emit DBML text.
//!
//! The result is a DBML *string* (not a `SchemaIR`) so it flows through the
//! normal parse pipeline and the user can review/edit it in the editor.

use crate::sql::SqlDialect;
use sqlparser::ast::{
    AlterTableOperation, ColumnDef, ColumnOption, Expr, IndexColumn, ObjectName, ReferentialAction,
    Statement, TableConstraint, UserDefinedTypeRepresentation,
};
use sqlparser::dialect::{MsSqlDialect, MySqlDialect, PostgreSqlDialect, SQLiteDialect};
use sqlparser::parser::Parser;

pub fn import_sql(sql: &str, dialect: &SqlDialect) -> Result<String, String> {
    let statements = parse(sql, dialect)?;
    let mut builder = DbmlBuilder::default();
    for stmt in statements {
        builder.add_statement(&stmt);
    }
    Ok(builder.render())
}

fn parse(sql: &str, dialect: &SqlDialect) -> Result<Vec<Statement>, String> {
    let result = match dialect {
        SqlDialect::Postgres => Parser::parse_sql(&PostgreSqlDialect {}, sql),
        SqlDialect::Mysql => Parser::parse_sql(&MySqlDialect {}, sql),
        SqlDialect::Sqlite => Parser::parse_sql(&SQLiteDialect {}, sql),
        SqlDialect::Mssql => Parser::parse_sql(&MsSqlDialect {}, sql),
    };
    result.map_err(|e| format!("SQL parse error: {}", e))
}

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------

#[derive(Default)]
struct ColumnSpec {
    name: String,
    sql_type: String,
    pk: bool,
    unique: bool,
    not_null: bool,
    increment: bool,
    default: Option<String>,
    note: Option<String>,
}

#[derive(Default)]
struct TableSpec {
    name: String,
    columns: Vec<ColumnSpec>,
    indexes: Vec<String>,
    note: Option<String>,
}

#[derive(Default)]
struct DbmlBuilder {
    tables: Vec<TableSpec>,
    refs: Vec<String>,
    enums: Vec<String>,
}

impl DbmlBuilder {
    fn add_statement(&mut self, stmt: &Statement) {
        match stmt {
            Statement::CreateTable(create) => self.add_table(create),
            Statement::CreateIndex(idx) => {
                let table = obj_last(&idx.table_name);
                let cols = index_columns(&idx.columns);
                let name = idx.name.as_ref().map(obj_last);
                let line = index_line(&cols, idx.unique, false, name.as_deref());
                if let Some(t) = self.table_mut(&table) {
                    t.indexes.push(line);
                }
            }
            Statement::AlterTable(alter) => {
                let table = obj_last(&alter.name);
                for op in &alter.operations {
                    if let AlterTableOperation::AddConstraint { constraint, .. } = op {
                        self.apply_constraint(&table, constraint);
                    }
                }
            }
            Statement::CreateType {
                name,
                representation: Some(UserDefinedTypeRepresentation::Enum { labels }),
            } => {
                let mut block = format!("Enum {} {{\n", dbml_ident(&obj_last(name)));
                for label in labels {
                    block.push_str(&format!("  {}\n", dbml_ident(&label.value)));
                }
                block.push('}');
                self.enums.push(block);
            }
            _ => {}
        }
    }

    fn add_table(&mut self, create: &sqlparser::ast::CreateTable) {
        let table_name = obj_last(&create.name);
        let mut spec = TableSpec {
            name: table_name.clone(),
            note: create.comment.as_ref().map(|c| c.to_string()),
            ..Default::default()
        };

        for col in &create.columns {
            spec.columns.push(self.convert_column(&table_name, col));
        }

        self.tables.push(spec);

        // Table-level constraints reference columns by name, so apply after push.
        for constraint in &create.constraints {
            self.apply_constraint(&table_name, constraint);
        }
    }

    fn convert_column(&mut self, table_name: &str, col: &ColumnDef) -> ColumnSpec {
        let name = col.name.value.clone();
        let sql_type = col.data_type.to_string();
        let mut spec = ColumnSpec {
            name: name.clone(),
            increment: sql_type.to_lowercase().contains("serial"),
            sql_type,
            ..Default::default()
        };

        for opt in &col.options {
            match &opt.option {
                ColumnOption::NotNull => spec.not_null = true,
                ColumnOption::Null => spec.not_null = false,
                ColumnOption::PrimaryKey(_) => spec.pk = true,
                ColumnOption::Unique(_) => spec.unique = true,
                ColumnOption::Default(expr) => spec.default = Some(render_default(expr)),
                ColumnOption::Comment(text) => spec.note = Some(text.clone()),
                ColumnOption::Identity(_) => spec.increment = true,
                ColumnOption::ForeignKey(fk) => {
                    let target_table = obj_last(&fk.foreign_table);
                    let target_col = fk
                        .referred_columns
                        .first()
                        .map(|i| i.value.clone())
                        .unwrap_or_else(|| "id".to_string());
                    let settings = ref_settings(&fk.on_delete, &fk.on_update);
                    self.refs.push(format!(
                        "Ref: {}.{} > {}.{}{}",
                        table_name, name, target_table, target_col, settings
                    ));
                }
                ColumnOption::DialectSpecific(tokens) => {
                    let joined = tokens
                        .iter()
                        .map(|t| t.to_string())
                        .collect::<Vec<_>>()
                        .join("")
                        .to_uppercase();
                    if joined.contains("AUTOINCREMENT") || joined.contains("AUTO_INCREMENT") {
                        spec.increment = true;
                    }
                }
                _ => {}
            }
        }

        spec
    }

    fn apply_constraint(&mut self, table_name: &str, constraint: &TableConstraint) {
        match constraint {
            TableConstraint::PrimaryKey(pk) => {
                let cols = index_columns(&pk.columns);
                self.mark_columns(table_name, &cols, |c| c.pk = true, |cols| {
                    index_line(cols, false, true, None)
                });
            }
            TableConstraint::Unique(u) => {
                let cols = index_columns(&u.columns);
                self.mark_columns(table_name, &cols, |c| c.unique = true, |cols| {
                    index_line(cols, true, false, None)
                });
            }
            TableConstraint::ForeignKey(fk) => {
                let from_cols: Vec<String> = fk.columns.iter().map(|i| i.value.clone()).collect();
                let to_table = obj_last(&fk.foreign_table);
                let to_cols: Vec<String> =
                    fk.referred_columns.iter().map(|i| i.value.clone()).collect();
                if from_cols.is_empty() || to_cols.is_empty() {
                    return;
                }
                let from = ref_endpoint(table_name, &from_cols);
                let to = ref_endpoint(&to_table, &to_cols);
                let settings = ref_settings(&fk.on_delete, &fk.on_update);
                self.refs.push(format!("Ref: {} > {}{}", from, to, settings));
            }
            TableConstraint::Index(idx) => {
                let cols = index_columns(&idx.columns);
                let name = idx.name.as_ref().map(|i| i.value.clone());
                let line = index_line(&cols, false, false, name.as_deref());
                if let Some(t) = self.table_mut(table_name) {
                    t.indexes.push(line);
                }
            }
            _ => {}
        }
    }

    /// Apply a single-column flag, or push a composite index line otherwise.
    fn mark_columns(
        &mut self,
        table_name: &str,
        cols: &[String],
        set_flag: impl Fn(&mut ColumnSpec),
        compose: impl Fn(&[String]) -> String,
    ) {
        let Some(table) = self.table_mut(table_name) else {
            return;
        };
        if cols.len() == 1 {
            if let Some(c) = table.columns.iter_mut().find(|c| c.name == cols[0]) {
                set_flag(c);
                return;
            }
        }
        table.indexes.push(compose(cols));
    }

    fn table_mut(&mut self, name: &str) -> Option<&mut TableSpec> {
        self.tables.iter_mut().find(|t| t.name == name)
    }

    fn render(&self) -> String {
        let mut out = String::new();
        for e in &self.enums {
            out.push_str(e);
            out.push_str("\n\n");
        }
        for t in &self.tables {
            out.push_str(&render_table(t));
            out.push_str("\n\n");
        }
        for r in &self.refs {
            out.push_str(r);
            out.push('\n');
        }
        let trimmed = out.trim_end();
        if trimmed.is_empty() {
            String::new()
        } else {
            format!("{}\n", trimmed)
        }
    }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

fn render_table(t: &TableSpec) -> String {
    let mut out = format!("Table {} {{\n", dbml_ident(&t.name));
    for col in &t.columns {
        out.push_str(&render_column(col));
        out.push('\n');
    }
    if !t.indexes.is_empty() {
        out.push_str("\n  indexes {\n");
        for idx in &t.indexes {
            out.push_str(&format!("    {}\n", idx));
        }
        out.push_str("  }\n");
    }
    if let Some(note) = &t.note {
        out.push_str(&format!("\n  Note: '{}'\n", escape_single(note)));
    }
    out.push('}');
    out
}

fn render_column(col: &ColumnSpec) -> String {
    let mut settings: Vec<String> = Vec::new();
    if col.pk {
        settings.push("pk".to_string());
    }
    if col.increment {
        settings.push("increment".to_string());
    }
    if col.unique {
        settings.push("unique".to_string());
    }
    if col.not_null && !col.pk {
        settings.push("not null".to_string());
    }
    if let Some(def) = &col.default {
        settings.push(format!("default: {}", def));
    }
    if let Some(note) = &col.note {
        settings.push(format!("note: '{}'", escape_single(note)));
    }

    let base = format!("  {} {}", dbml_ident(&col.name), dbml_type(&col.sql_type));
    if settings.is_empty() {
        base
    } else {
        format!("{} [{}]", base, settings.join(", "))
    }
}

fn index_line(cols: &[String], unique: bool, pk: bool, name: Option<&str>) -> String {
    let cols_str = if cols.len() == 1 {
        cols[0].clone()
    } else {
        format!("({})", cols.join(", "))
    };
    let mut settings: Vec<String> = Vec::new();
    if pk {
        settings.push("pk".to_string());
    }
    if unique {
        settings.push("unique".to_string());
    }
    if let Some(n) = name {
        settings.push(format!("name: '{}'", escape_single(n)));
    }
    if settings.is_empty() {
        cols_str
    } else {
        format!("{} [{}]", cols_str, settings.join(", "))
    }
}

fn ref_endpoint(table: &str, cols: &[String]) -> String {
    if cols.len() == 1 {
        format!("{}.{}", table, cols[0])
    } else {
        format!("{}.({})", table, cols.join(", "))
    }
}

fn ref_settings(
    on_delete: &Option<ReferentialAction>,
    on_update: &Option<ReferentialAction>,
) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(a) = on_delete {
        parts.push(format!("delete: {}", action_str(a)));
    }
    if let Some(a) = on_update {
        parts.push(format!("update: {}", action_str(a)));
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!(" [{}]", parts.join(", "))
    }
}

fn action_str(a: &ReferentialAction) -> &'static str {
    match a {
        ReferentialAction::Cascade => "cascade",
        ReferentialAction::Restrict => "restrict",
        ReferentialAction::SetNull => "set null",
        ReferentialAction::SetDefault => "set default",
        ReferentialAction::NoAction => "no action",
    }
}

fn render_default(expr: &Expr) -> String {
    let s = expr.to_string();
    if s.starts_with('\'') {
        return s;
    }
    let lower = s.to_lowercase();
    if lower == "true" || lower == "false" || lower == "null" {
        return s;
    }
    if s.parse::<f64>().is_ok() {
        return s;
    }
    format!("`{}`", s)
}

fn index_columns(cols: &[IndexColumn]) -> Vec<String> {
    cols.iter().map(|c| expr_col_name(&c.column.expr)).collect()
}

fn expr_col_name(e: &Expr) -> String {
    match e {
        Expr::Identifier(id) => id.value.clone(),
        Expr::CompoundIdentifier(parts) => {
            parts.last().map(|i| i.value.clone()).unwrap_or_default()
        }
        other => other.to_string(),
    }
}

fn obj_last(name: &ObjectName) -> String {
    name.0
        .last()
        .and_then(|p| p.as_ident())
        .map(|i| i.value.clone())
        .unwrap_or_else(|| name.to_string())
}

fn dbml_ident(s: &str) -> String {
    let needs = s.is_empty() || s.chars().any(|c| !(c.is_alphanumeric() || c == '_'));
    if needs {
        format!("\"{}\"", s)
    } else {
        s.to_string()
    }
}

fn dbml_type(s: &str) -> String {
    if s.chars().any(|c| c.is_whitespace()) {
        format!("\"{}\"", s)
    } else {
        s.to_string()
    }
}

fn escape_single(s: &str) -> String {
    s.replace('\'', "\\'")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn import(sql: &str, dialect: SqlDialect) -> String {
        import_sql(sql, &dialect).expect("import failed")
    }

    #[test]
    fn basic_table_postgres() {
        let sql = "CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) UNIQUE NOT NULL\n);";
        let dbml = import(sql, SqlDialect::Postgres);
        assert!(dbml.contains("Table users {"));
        assert!(dbml.contains("id"));
        assert!(dbml.contains("[pk"));
        assert!(dbml.contains("increment"));
        assert!(dbml.contains("email"));
        assert!(dbml.contains("unique"));
        assert!(dbml.contains("not null"));
    }

    #[test]
    fn foreign_key_alter_table() {
        let sql = "CREATE TABLE users (id INT PRIMARY KEY);\n\
                   CREATE TABLE posts (id INT PRIMARY KEY, user_id INT);\n\
                   ALTER TABLE posts ADD CONSTRAINT fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;";
        let dbml = import(sql, SqlDialect::Postgres);
        assert!(dbml.contains("Ref: posts.user_id > users.id [delete: cascade]"));
    }

    #[test]
    fn inline_foreign_key() {
        let sql = "CREATE TABLE users (id INT PRIMARY KEY);\n\
                   CREATE TABLE posts (id INT PRIMARY KEY, user_id INT REFERENCES users(id));";
        let dbml = import(sql, SqlDialect::Postgres);
        assert!(dbml.contains("Ref: posts.user_id > users.id"));
    }

    #[test]
    fn composite_primary_key() {
        let sql = "CREATE TABLE post_tags (post_id INT, tag_id INT, PRIMARY KEY (post_id, tag_id));";
        let dbml = import(sql, SqlDialect::Postgres);
        assert!(dbml.contains("indexes {"));
        assert!(dbml.contains("(post_id, tag_id) [pk]"));
    }

    #[test]
    fn create_index() {
        let sql = "CREATE TABLE t (a INT, b INT);\nCREATE UNIQUE INDEX idx_ab ON t (a, b);";
        let dbml = import(sql, SqlDialect::Postgres);
        assert!(dbml.contains("(a, b) [unique, name: 'idx_ab']"));
    }

    #[test]
    fn enum_type_postgres() {
        let sql = "CREATE TYPE status AS ENUM ('draft', 'published');";
        let dbml = import(sql, SqlDialect::Postgres);
        assert!(dbml.contains("Enum status {"));
        assert!(dbml.contains("draft"));
        assert!(dbml.contains("published"));
    }

    #[test]
    fn mysql_auto_increment() {
        let sql = "CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50));";
        let dbml = import(sql, SqlDialect::Mysql);
        assert!(dbml.contains("increment"));
    }

    #[test]
    fn default_values() {
        let sql = "CREATE TABLE t (\n  status VARCHAR(20) DEFAULT 'active',\n  count INT DEFAULT 0,\n  created TIMESTAMP DEFAULT now()\n);";
        let dbml = import(sql, SqlDialect::Postgres);
        assert!(dbml.contains("default: 'active'"));
        assert!(dbml.contains("default: 0"));
        assert!(dbml.contains("default: `now()`"));
    }
}
