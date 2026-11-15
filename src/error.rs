//! User-facing application errors.
//!
//! Native module methods map these to `String` at the NSH boundary.

use thiserror::Error;

use crate::camera::CameraError;
use crate::wifi::WifiError;

/// A recoverable failure that can be shown in the UI.
#[derive(Debug, Error)]
pub enum AppError {
    /// A complete message, already written for the user.
    #[error("{0}")]
    Message(String),
    /// A camera HTTP or parse failure.
    #[error("{0}")]
    Camera(#[from] CameraError),
    /// A Wi-Fi inspection or join failure.
    #[error("{0}")]
    Wifi(#[from] WifiError),
    /// A filesystem failure, with a short context phrase.
    #[error("{context}：{source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },
}

impl AppError {
    pub fn msg(text: impl Into<String>) -> Self {
        Self::Message(text.into())
    }

    pub fn io(context: impl Into<String>, source: std::io::Error) -> Self {
        Self::Io {
            context: context.into(),
            source,
        }
    }
}

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}
