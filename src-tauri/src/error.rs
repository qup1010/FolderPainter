use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Network Error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("JSON Error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Configuration Error: {0}")]
    Config(String),

    #[error("AI Service Error: {0}")]
    Ai(String),

    #[error("API Error: {0}")]
    Api(String),

    #[error("System Error: {0}")]
    System(String),
}

// Implement Serialize so we can return Result<T, AppError> to Tauri frontend
// Tauri creates a string error message from the serialized value if it fails?
// Actually simpler: Tauri commands returning Result<T, E> require E to implement Serialize.
// We'll serialize it as a simple string message to be compatible with existing frontend which expects string errors.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// Helper to convert strings to AppError easily (for quick migration)
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::System(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::System(s.to_string())
    }
}
