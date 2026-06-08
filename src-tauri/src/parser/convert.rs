use dbml_rs::ast;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SchemaIR {
    pub tables: Vec<TableIR>,
    pub refs: Vec<RefIR>,
    pub enums: Vec<EnumIR>,
    pub table_groups: Vec<TableGroupIR>,
    pub project: Option<ProjectIR>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TableIR {
    pub name: String,
    pub schema: Option<String>,
    pub alias: Option<String>,
    pub columns: Vec<ColumnIR>,
    pub indexes: Vec<IndexIR>,
    pub note: Option<String>,
    pub span_range: (usize, usize),
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ColumnIR {
    pub name: String,
    pub r#type: String,
    pub is_pk: bool,
    pub is_unique: bool,
    pub is_nullable: bool,
    pub is_incremental: bool,
    pub default_value: Option<String>,
    pub note: Option<String>,
    pub span_range: (usize, usize),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefIR {
    pub name: Option<String>,
    pub relation: String,
    pub from_table: String,
    pub from_schema: Option<String>,
    pub from_columns: Vec<String>,
    pub to_table: String,
    pub to_schema: Option<String>,
    pub to_columns: Vec<String>,
    pub on_delete: Option<String>,
    pub on_update: Option<String>,
    pub span_range: (usize, usize),
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EnumIR {
    pub name: String,
    pub schema: Option<String>,
    pub values: Vec<EnumValueIR>,
    pub span_range: (usize, usize),
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EnumValueIR {
    pub name: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IndexIR {
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_pk: bool,
    pub index_type: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TableGroupIR {
    pub name: String,
    pub tables: Vec<String>,
    pub span_range: (usize, usize),
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIR {
    pub name: String,
    pub note: Option<String>,
    pub database_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseError {
    pub message: String,
    pub span: Option<(usize, usize)>,
}

pub fn convert_schema(schema: &ast::SchemaBlock<'_>) -> SchemaIR {
    let tables: Vec<TableIR> = schema.tables().into_iter().map(convert_table).collect();
    let mut refs: Vec<RefIR> = schema.refs().into_iter().map(convert_ref).collect();

    collect_inline_refs(&tables, schema, &mut refs);

    let enums = schema.enums().into_iter().map(convert_enum).collect();
    let table_groups = schema.table_groups().into_iter().map(convert_table_group).collect();
    let project = schema.projects().first().map(|p| convert_project(p));

    SchemaIR {
        tables,
        refs,
        enums,
        table_groups,
        project,
    }
}

fn convert_table(table: &ast::TableBlock) -> TableIR {
    let columns = table.cols.iter().map(convert_column).collect();
    let indexes = table
        .indexes
        .as_ref()
        .map(|idx| idx.defs.iter().map(convert_index).collect())
        .unwrap_or_default();

    TableIR {
        name: table.ident.name.to_string.clone(),
        schema: table.ident.schema.as_ref().map(|s| s.to_string.clone()),
        alias: table.ident.alias.as_ref().map(|a| a.to_string.clone()),
        columns,
        indexes,
        note: table.note.as_ref().map(|n| n.value.raw.clone()),
        span_range: (table.span_range.start, table.span_range.end),
    }
}

fn convert_column(col: &ast::TableColumn) -> ColumnIR {
    let settings = col.settings.as_ref();

    let is_nullable = settings
        .and_then(|s| s.nullable.as_ref())
        .map(|n| *n == ast::Nullable::Null)
        .unwrap_or(true);

    let default_value = settings
        .and_then(|s| s.default.as_ref())
        .map(|v| value_to_string(v));

    ColumnIR {
        name: col.name.to_string.clone(),
        r#type: col.r#type.raw.clone(),
        is_pk: settings.map(|s| s.is_pk).unwrap_or(false),
        is_unique: settings.map(|s| s.is_unique).unwrap_or(false),
        is_nullable,
        is_incremental: settings.map(|s| s.is_incremental).unwrap_or(false),
        default_value,
        note: settings.and_then(|s| s.note.clone()),
        span_range: (col.span_range.start, col.span_range.end),
    }
}

fn convert_ref(r: &ast::RefBlock) -> RefIR {
    RefIR {
        name: r.name.as_ref().map(|n| n.to_string.clone()),
        relation: relation_to_string(&r.rel),
        from_table: r.lhs.table.to_string.clone(),
        from_schema: r.lhs.schema.as_ref().map(|s| s.to_string.clone()),
        from_columns: r.lhs.compositions.iter().map(|c| c.to_string.clone()).collect(),
        to_table: r.rhs.table.to_string.clone(),
        to_schema: r.rhs.schema.as_ref().map(|s| s.to_string.clone()),
        to_columns: r.rhs.compositions.iter().map(|c| c.to_string.clone()).collect(),
        on_delete: r.settings.as_ref().and_then(|s| s.on_delete.as_ref().map(referential_action_to_string)),
        on_update: r.settings.as_ref().and_then(|s| s.on_update.as_ref().map(referential_action_to_string)),
        span_range: (r.span_range.start, r.span_range.end),
    }
}

fn collect_inline_refs(_tables: &[TableIR], schema: &ast::SchemaBlock<'_>, refs: &mut Vec<RefIR>) {
    for table_ast in schema.tables() {
        let table_name = &table_ast.ident.name.to_string;
        let table_schema = table_ast.ident.schema.as_ref().map(|s| &s.to_string);

        for col in &table_ast.cols {
            if let Some(settings) = &col.settings {
                for inline_ref in &settings.refs {
                    refs.push(RefIR {
                        name: None,
                        relation: relation_to_string(&inline_ref.rel),
                        from_table: table_name.clone(),
                        from_schema: table_schema.cloned(),
                        from_columns: vec![col.name.to_string.clone()],
                        to_table: inline_ref.rhs.table.to_string.clone(),
                        to_schema: inline_ref.rhs.schema.as_ref().map(|s| s.to_string.clone()),
                        to_columns: inline_ref.rhs.compositions.iter().map(|c| c.to_string.clone()).collect(),
                        on_delete: None,
                        on_update: None,
                        span_range: (inline_ref.span_range.start, inline_ref.span_range.end),
                    });
                }
            }
        }
    }
}

fn convert_enum(e: &ast::EnumBlock) -> EnumIR {
    EnumIR {
        name: e.ident.name.to_string.clone(),
        schema: e.ident.schema.as_ref().map(|s| s.to_string.clone()),
        values: e.values.iter().map(|v| EnumValueIR {
            name: v.value.to_string.clone(),
            note: v.settings.as_ref().and_then(|s| s.note.clone()),
        }).collect(),
        span_range: (e.span_range.start, e.span_range.end),
    }
}

fn convert_index(idx: &ast::IndexesDef) -> IndexIR {
    let columns = idx.cols.iter().map(|col| match col {
        ast::IndexesColumnType::String(ident) => ident.to_string.clone(),
        ast::IndexesColumnType::Expr(literal) => format!("`{}`", literal.raw),
    }).collect();

    let settings = idx.settings.as_ref();

    IndexIR {
        columns,
        is_unique: settings.map(|s| s.is_unique).unwrap_or(false),
        is_pk: settings.map(|s| s.is_pk).unwrap_or(false),
        index_type: settings.and_then(|s| s.r#type.as_ref().map(index_type_to_string)),
        name: settings.and_then(|s| s.name.clone()),
    }
}

fn convert_table_group(tg: &ast::TableGroupBlock) -> TableGroupIR {
    let tables = tg.items.iter().map(|item| {
        match &item.schema {
            Some(schema) => format!("{}.{}", schema.to_string, item.ident_alias.to_string),
            None => item.ident_alias.to_string.clone(),
        }
    }).collect();

    TableGroupIR {
        name: tg.ident.to_string.clone(),
        tables,
        span_range: (tg.span_range.start, tg.span_range.end),
    }
}

fn convert_project(p: &ast::ProjectBlock) -> ProjectIR {
    let database_type = p.database_type.as_ref().map(|dt| match dt {
        ast::DatabaseType::PostgreSQL => "PostgreSQL".to_string(),
        ast::DatabaseType::Unknown(s) => s.clone(),
    });

    ProjectIR {
        name: p.ident.to_string.clone(),
        note: p.note.as_ref().map(|n| n.value.raw.clone()),
        database_type,
    }
}

fn relation_to_string(rel: &ast::Relation) -> String {
    match rel {
        ast::Relation::One2One => "one_to_one".to_string(),
        ast::Relation::One2Many => "one_to_many".to_string(),
        ast::Relation::Many2One => "many_to_one".to_string(),
        ast::Relation::Many2Many => "many_to_many".to_string(),
        ast::Relation::Undef => "undefined".to_string(),
    }
}

fn referential_action_to_string(action: &ast::ReferentialAction) -> String {
    match action {
        ast::ReferentialAction::NoAction => "no_action".to_string(),
        ast::ReferentialAction::Cascade => "cascade".to_string(),
        ast::ReferentialAction::Restrict => "restrict".to_string(),
        ast::ReferentialAction::SetNull => "set_null".to_string(),
        ast::ReferentialAction::SetDefault => "set_default".to_string(),
    }
}

fn index_type_to_string(t: &ast::IndexesType) -> String {
    match t {
        ast::IndexesType::BTree => "btree".to_string(),
        ast::IndexesType::Gin => "gin".to_string(),
        ast::IndexesType::Gist => "gist".to_string(),
        ast::IndexesType::Hash => "hash".to_string(),
    }
}

fn value_to_string(v: &ast::Value) -> String {
    match v {
        ast::Value::String(s) => format!("'{s}'"),
        ast::Value::Integer(i) => i.to_string(),
        ast::Value::Decimal(d) => d.to_string(),
        ast::Value::Bool(b) => b.to_string(),
        ast::Value::Expr(e) => format!("`{e}`"),
        ast::Value::Enum(e) => e.clone(),
        ast::Value::HexColor(h) => h.clone(),
        ast::Value::Null => "null".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_basic_table() {
        let input = r#"
Table users {
  id integer [pk, increment]
  email varchar(255) [unique, not null]
  name varchar(100)
  created_at timestamp [default: `now()`]
}
"#;
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);

        assert_eq!(ir.tables.len(), 1);
        let table = &ir.tables[0];
        assert_eq!(table.name, "users");
        assert_eq!(table.columns.len(), 4);

        let id_col = &table.columns[0];
        assert_eq!(id_col.name, "id");
        assert_eq!(id_col.r#type, "integer");
        assert!(id_col.is_pk);
        assert!(id_col.is_incremental);

        let email_col = &table.columns[1];
        assert_eq!(email_col.name, "email");
        assert!(email_col.is_unique);
        assert!(!email_col.is_nullable);
    }

    #[test]
    fn test_convert_relationships() {
        let input = r#"
Table users {
  id integer [pk]
}
Table posts {
  id integer [pk]
  user_id integer
}
Ref: posts.user_id > users.id [delete: cascade]
"#;
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);

        assert_eq!(ir.refs.len(), 1);
        let r = &ir.refs[0];
        assert_eq!(r.relation, "many_to_one");
        assert_eq!(r.from_table, "posts");
        assert_eq!(r.from_columns, vec!["user_id"]);
        assert_eq!(r.to_table, "users");
        assert_eq!(r.to_columns, vec!["id"]);
        assert_eq!(r.on_delete.as_deref(), Some("cascade"));
    }

    #[test]
    fn test_convert_enum() {
        let input = r#"
Enum job_status {
  created [note: 'Waiting to be processed']
  running
  done
  failure
}
"#;
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);

        assert_eq!(ir.enums.len(), 1);
        let e = &ir.enums[0];
        assert_eq!(e.name, "job_status");
        assert_eq!(e.values.len(), 4);
        assert_eq!(e.values[0].name, "created");
        assert_eq!(e.values[0].note.as_deref(), Some("Waiting to be processed"));
    }

    #[test]
    fn test_convert_inline_ref() {
        let input = r#"
Table users {
  id integer [pk]
}
Table posts {
  id integer [pk]
  user_id integer [ref: > users.id]
}
"#;
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);

        assert_eq!(ir.refs.len(), 1);
        let r = &ir.refs[0];
        assert_eq!(r.relation, "many_to_one");
        assert_eq!(r.from_table, "posts");
        assert_eq!(r.to_table, "users");
    }

    #[test]
    fn test_convert_empty_input() {
        let input = "";
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);

        assert!(ir.tables.is_empty());
        assert!(ir.refs.is_empty());
        assert!(ir.enums.is_empty());
    }

    #[test]
    fn test_convert_project() {
        let input = r#"
Project ecommerce {
  database_type: 'PostgreSQL'
  Note: 'E-commerce database'
}
"#;
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);

        assert!(ir.project.is_some());
        let p = ir.project.unwrap();
        assert_eq!(p.name, "ecommerce");
        assert_eq!(p.database_type.as_deref(), Some("PostgreSQL"));
    }

    #[test]
    fn test_convert_table_group() {
        let input = r#"
Table users {
  id integer [pk]
}
Table posts {
  id integer [pk]
}
TableGroup blog {
  users
  posts
}
"#;
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);

        assert_eq!(ir.table_groups.len(), 1);
        let tg = &ir.table_groups[0];
        assert_eq!(tg.name, "blog");
        assert_eq!(tg.tables.len(), 2);
    }

    #[test]
    fn test_convert_indexes() {
        let input = r#"
Table products {
  id integer [pk]
  name varchar
  merchant_id integer

  indexes {
    (merchant_id, name) [unique, name: 'idx_merchant_product']
    name [type: hash]
  }
}
"#;
        let ast = dbml_rs::parse_dbml(input).expect("parse failed");
        let ir = convert_schema(&ast);

        let table = &ir.tables[0];
        assert_eq!(table.indexes.len(), 2);
        let idx = &table.indexes[0];
        assert!(idx.is_unique);
        assert_eq!(idx.name.as_deref(), Some("idx_merchant_product"));
        assert_eq!(idx.columns, vec!["merchant_id", "name"]);
    }
}
