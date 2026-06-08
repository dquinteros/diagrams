pub mod postgres;
pub mod mysql;
pub mod sqlite;
pub mod mssql;

use crate::parser::convert::SchemaIR;

pub enum SqlDialect {
    Postgres,
    Mysql,
    Sqlite,
    Mssql,
}

impl SqlDialect {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "postgres" => Some(Self::Postgres),
            "mysql" => Some(Self::Mysql),
            "sqlite" => Some(Self::Sqlite),
            "mssql" => Some(Self::Mssql),
            _ => None,
        }
    }
}

pub trait SqlGenerator {
    fn generate(&self, schema: &SchemaIR) -> Result<String, String>;
}

pub fn generate_sql(schema: &SchemaIR, dialect: &SqlDialect) -> Result<String, String> {
    match dialect {
        SqlDialect::Postgres => postgres::PostgresGenerator.generate(schema),
        SqlDialect::Mysql => mysql::MysqlGenerator.generate(schema),
        SqlDialect::Sqlite => sqlite::SqliteGenerator.generate(schema),
        SqlDialect::Mssql => mssql::MssqlGenerator.generate(schema),
    }
}
