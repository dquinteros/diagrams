use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Parse error: {0}")]
    Parse(String),

    #[error("SQL generation error: {0}")]
    SqlGeneration(String),

    #[error("File error: {0}")]
    FileIo(#[from] std::io::Error),

    #[error("Export error: {0}")]
    Export(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
