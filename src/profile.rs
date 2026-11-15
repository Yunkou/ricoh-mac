//! Camera profile metadata stored under `data_dir`.
//!
//! Wi-Fi passwords are kept in a [`SecretStore`], never in this file.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::keychain::SecretStore;

use crate::error::AppError;

const FILE_NAME: &str = "camera-profiles.json";
const SESSION_FILE: &str = "wifi-session.json";

/// One saved camera, minus its Wi-Fi password.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CameraProfile {
    pub id: String,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub firmware: Option<String>,
    pub ssid: String,
    pub base_url: String,
    pub created_at: u64,
    pub last_used_at: u64,
}

/// All saved profiles and user preferences.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProfileStore {
    pub version: u32,
    pub auto_switch_back: bool,
    pub active_profile_id: Option<String>,
    pub profiles: Vec<CameraProfile>,
}

impl Default for ProfileStore {
    fn default() -> Self {
        Self {
            version: 1,
            auto_switch_back: true,
            active_profile_id: None,
            profiles: Vec::new(),
        }
    }
}

impl ProfileStore {
    pub fn path(dir: &Path) -> PathBuf {
        dir.join(FILE_NAME)
    }

    pub fn load(dir: &Path) -> Result<Self, AppError> {
        let path = Self::path(dir);
        if !path.exists() {
            return Ok(Self::default());
        }
        let text =
            fs::read_to_string(&path).map_err(|_err| AppError::msg("无法读取已保存的相机。"))?;
        serde_json::from_str(&text)
            .map_err(|_err| AppError::msg("已保存的相机信息无法使用，请重新保存。"))
    }

    pub fn save(&self, dir: &Path) -> Result<(), AppError> {
        fs::create_dir_all(dir).map_err(|_err| AppError::msg("无法保存相机信息。"))?;
        let path = Self::path(dir);
        let tmp = dir.join(format!("{FILE_NAME}.tmp"));
        let text = serde_json::to_string_pretty(self)
            .map_err(|_err| AppError::msg("无法保存相机信息。"))?;
        fs::write(&tmp, text).map_err(|_err| AppError::msg("无法保存相机信息。"))?;
        fs::rename(&tmp, &path).map_err(|_err| AppError::msg("无法保存相机信息。"))
    }

    pub fn active(&self) -> Option<&CameraProfile> {
        self.active_profile_id
            .as_ref()
            .and_then(|id| self.profiles.iter().find(|profile| &profile.id == id))
            .or_else(|| self.profiles.first())
    }

    pub fn upsert(&mut self, profile: CameraProfile) {
        if let Some(existing) = self.profiles.iter_mut().find(|item| item.id == profile.id) {
            *existing = profile.clone();
        } else {
            self.profiles.push(profile.clone());
        }
        self.active_profile_id = Some(profile.id);
    }

    pub fn remove(&mut self, id: &str) {
        self.profiles.retain(|profile| profile.id != id);
        if self.active_profile_id.as_deref() == Some(id) {
            self.active_profile_id = self.profiles.first().map(|profile| profile.id.clone());
        }
    }

    pub fn set_active(&mut self, id: &str) -> Result<(), AppError> {
        if !self.profiles.iter().any(|profile| profile.id == id) {
            return Err(AppError::msg("找不到这台相机。"));
        }
        self.active_profile_id = Some(id.to_string());
        Ok(())
    }
}

/// The Wi-Fi network the Mac was on before switching to the camera.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct WifiSession {
    pub previous_ssid: Option<String>,
    pub switched: bool,
}

impl WifiSession {
    pub fn path(dir: &Path) -> PathBuf {
        dir.join(SESSION_FILE)
    }

    pub fn load(dir: &Path) -> Result<Self, AppError> {
        let path = Self::path(dir);
        if !path.exists() {
            return Ok(Self::default());
        }
        let text =
            fs::read_to_string(&path).map_err(|_err| AppError::msg("无法读取上次的网络状态。"))?;
        serde_json::from_str(&text).map_err(|_err| AppError::msg("无法读取上次的网络状态。"))
    }

    pub fn save(&self, dir: &Path) -> Result<(), AppError> {
        fs::create_dir_all(dir).map_err(|_err| AppError::msg("无法保存网络状态。"))?;
        let path = Self::path(dir);
        let tmp = dir.join(format!("{SESSION_FILE}.tmp"));
        let text = serde_json::to_string_pretty(self)
            .map_err(|_err| AppError::msg("无法保存网络状态。"))?;
        fs::write(&tmp, text).map_err(|_err| AppError::msg("无法保存网络状态。"))?;
        fs::rename(&tmp, &path).map_err(|_err| AppError::msg("无法保存网络状态。"))
    }

    pub fn clear(dir: &Path) -> Result<(), AppError> {
        Self::default().save(dir)
    }
}

/// Build a stable id from serial, otherwise from SSID.
pub fn profile_id(serial: Option<&str>, ssid: &str) -> String {
    match serial.map(str::trim).filter(|value| !value.is_empty()) {
        Some(serial) => format!("serial:{serial}"),
        None => format!("ssid:{ssid}"),
    }
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Save or update a profile and store its password in the secret store.
pub fn save_profile(
    dir: &Path,
    secrets: &impl SecretStore,
    mut profile: CameraProfile,
    password: &str,
) -> Result<CameraProfile, AppError> {
    let ssid = crate::wifi::validate_ssid(&profile.ssid).map_err(AppError::from)?;
    crate::wifi::validate_password(password).map_err(AppError::from)?;
    profile.ssid = ssid.to_string();
    if profile.id.is_empty() {
        profile.id = profile_id(profile.serial.as_deref(), &profile.ssid);
    }
    let now = now_secs();
    if profile.created_at == 0 {
        profile.created_at = now;
    }
    profile.last_used_at = now;
    secrets.set_secret(&profile.id, password)?;
    let mut store = ProfileStore::load(dir)?;
    store.upsert(profile.clone());
    store.save(dir)?;
    Ok(profile)
}

pub fn set_auto_switch_back(dir: &Path, value: bool) -> Result<ProfileStore, AppError> {
    let mut store = ProfileStore::load(dir)?;
    store.auto_switch_back = value;
    store.save(dir)?;
    Ok(store)
}

pub fn set_active_profile(dir: &Path, id: &str) -> Result<ProfileStore, AppError> {
    let mut store = ProfileStore::load(dir)?;
    store.set_active(id)?;
    store.save(dir)?;
    Ok(store)
}

pub fn delete_profile(
    dir: &Path,
    secrets: &impl SecretStore,
    id: &str,
) -> Result<ProfileStore, AppError> {
    secrets.delete_secret(id)?;
    let mut store = ProfileStore::load(dir)?;
    store.remove(id);
    store.save(dir)?;
    Ok(store)
}

#[cfg(test)]
mod tests {
    use super::{CameraProfile, ProfileStore, delete_profile, profile_id, save_profile};
    use crate::keychain::{MemorySecrets, SecretStore};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> std::path::PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "ricoh-mac-profile-{}-{}-{}",
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn save_load_keeps_password_out_of_the_file() {
        let dir = temp_dir();
        let secrets = MemorySecrets::default();
        let saved = save_profile(
            &dir,
            &secrets,
            CameraProfile {
                id: String::new(),
                model: Some("RICOH GR IIIx".into()),
                serial: Some("123".into()),
                firmware: Some("1.65".into()),
                ssid: "GR_123".into(),
                base_url: "http://192.168.0.1".into(),
                created_at: 0,
                last_used_at: 0,
            },
            "p@ss",
        )
        .unwrap();
        assert_eq!(saved.id, "serial:123");
        assert_eq!(
            secrets.get_secret(&saved.id).unwrap().as_deref(),
            Some("p@ss")
        );
        let text = std::fs::read_to_string(ProfileStore::path(&dir)).unwrap();
        assert!(!text.contains("p@ss"));
        assert!(text.contains("GR_123"));
        let loaded = ProfileStore::load(&dir).unwrap();
        assert_eq!(loaded.profiles.len(), 1);
        assert_eq!(loaded.active().unwrap().ssid, "GR_123");
        delete_profile(&dir, &secrets, &saved.id).unwrap();
        assert!(ProfileStore::load(&dir).unwrap().profiles.is_empty());
        assert_eq!(secrets.get_secret(&saved.id).unwrap(), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn set_active_switches_the_current_profile() {
        let dir = temp_dir();
        let secrets = MemorySecrets::default();
        let first = save_profile(
            &dir,
            &secrets,
            CameraProfile {
                id: "one".to_string(),
                model: Some("GR IIIx".to_string()),
                serial: Some("A".to_string()),
                firmware: None,
                ssid: "GR_ONE".to_string(),
                base_url: "http://192.168.0.1".to_string(),
                created_at: 0,
                last_used_at: 0,
            },
            "password12",
        )
        .unwrap();
        let second = save_profile(
            &dir,
            &secrets,
            CameraProfile {
                id: "two".to_string(),
                model: Some("GR IIIx".to_string()),
                serial: Some("B".to_string()),
                firmware: None,
                ssid: "GR_TWO".to_string(),
                base_url: "http://192.168.0.1".to_string(),
                created_at: 0,
                last_used_at: 0,
            },
            "password34",
        )
        .unwrap();
        assert_eq!(
            ProfileStore::load(&dir).unwrap().active().unwrap().id,
            second.id
        );
        let store = super::set_active_profile(&dir, &first.id).unwrap();
        assert_eq!(store.active().unwrap().id, first.id);
        assert_eq!(
            ProfileStore::load(&dir).unwrap().active().unwrap().id,
            first.id
        );
        let err = super::set_active_profile(&dir, "missing")
            .unwrap_err()
            .to_string();
        assert!(err.contains("找不到这台相机"), "{err}");
    }

    #[test]
    fn profile_id_falls_back_to_ssid() {
        assert_eq!(profile_id(None, "GR_X"), "ssid:GR_X");
        assert_eq!(profile_id(Some("  "), "GR_X"), "ssid:GR_X");
        assert_eq!(profile_id(Some("ABC"), "GR_X"), "serial:ABC");
    }
}
