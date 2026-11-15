//! Library folder and camera base URL, stored as JSON in a data directory.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::error::AppError;

use serde::{Deserialize, Serialize};

/// Default camera origin used when no override has been saved.
pub const DEFAULT_CAMERA_BASE_URL: &str = "http://192.168.0.1";

/// Persisted application settings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppConfig {
    /// Absolute path of the single library folder, if the user has chosen one.
    #[serde(default)]
    pub library_folder: Option<String>,
    /// Camera HTTP origin, without a trailing slash. Defaults to `http://192.168.0.1`.
    #[serde(default = "default_camera_base_url")]
    pub camera_base_url: String,
}

fn default_camera_base_url() -> String {
    DEFAULT_CAMERA_BASE_URL.to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            library_folder: None,
            camera_base_url: default_camera_base_url(),
        }
    }
}

impl AppConfig {
    /// Load settings from `dir/config.json`, or defaults if the file does not exist.
    pub fn load(dir: &Path) -> Result<Self, AppError> {
        let path = config_path(dir);
        match fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str(&text)
                .map_err(|err| AppError::msg(format!("Could not read {}: {err}", path.display()))),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(err) => Err(AppError::msg(format!(
                "Could not read {}: {err}",
                path.display()
            ))),
        }
    }

    /// Write settings to `dir/config.json` using a temporary file and an atomic rename.
    pub fn save(&self, dir: &Path) -> Result<(), AppError> {
        fs::create_dir_all(dir)
            .map_err(|err| AppError::msg(format!("Could not create data directory: {err}")))?;
        let path = config_path(dir);
        let tmp = dir.join("config.json.tmp");
        let body = serde_json::to_vec_pretty(self)
            .map_err(|err| AppError::msg(format!("Could not serialize settings: {err}")))?;
        {
            let mut file = fs::File::create(&tmp).map_err(|err| {
                AppError::msg(format!("Could not write {}: {err}", tmp.display()))
            })?;
            file.write_all(&body).map_err(|err| {
                AppError::msg(format!("Could not write {}: {err}", tmp.display()))
            })?;
            file.write_all(b"\n").map_err(|err| {
                AppError::msg(format!("Could not write {}: {err}", tmp.display()))
            })?;
            file.sync_all().map_err(|err| {
                AppError::msg(format!("Could not write {}: {err}", tmp.display()))
            })?;
        }
        fs::rename(&tmp, &path)
            .map_err(|err| AppError::msg(format!("Could not replace {}: {err}", path.display())))?;
        Ok(())
    }
}

/// Path of the settings file in a data directory.
pub fn config_path(dir: &Path) -> PathBuf {
    dir.join("config.json")
}

/// Normalize a camera base URL: trim, drop a trailing slash, and reject an empty value.
pub fn normalize_camera_base_url(url: &str) -> Result<String, AppError> {
    let trimmed = url.trim().trim_end_matches('/').to_string();
    if trimmed.is_empty() {
        return Err(AppError::msg("Camera base URL is empty"));
    }
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err(AppError::msg(
            "Camera base URL must start with http:// or https://",
        ));
    }
    Ok(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "ricoh-mac-config-{}-{}-{}",
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        fs::create_dir_all(&dir).expect("create test data directory");
        dir
    }

    #[test]
    fn load_returns_defaults_when_missing() {
        let dir = temp_dir();
        let cfg = AppConfig::load(&dir).unwrap();
        assert_eq!(cfg, AppConfig::default());
        assert_eq!(cfg.camera_base_url, DEFAULT_CAMERA_BASE_URL);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = temp_dir();
        let cfg = AppConfig {
            library_folder: Some("/tmp/library".to_string()),
            camera_base_url: "http://127.0.0.1:8080".to_string(),
        };
        cfg.save(&dir).unwrap();
        let loaded = AppConfig::load(&dir).unwrap();
        assert_eq!(loaded, cfg);
        let _ = fs::remove_dir_all(dir);
    }
}
