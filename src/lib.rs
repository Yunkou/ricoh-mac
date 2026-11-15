//! Native modules used by `App.tsx`: library settings, camera probe, listing, and import.

mod album;
mod camera;
mod config;
mod connect;
mod error;
mod importer;
mod keychain;
pub mod mock_camera;
mod profile;
mod wifi;

#[cfg(test)]
mod icon_assets;

use std::path::{Path, PathBuf};

use nsh_core::file_dialog::OpenDialog;
use nsh_core::prelude::*;

use album::{file_url, list_imported_photos};
use camera::{CameraClient, CameraPhoto};
use config::{AppConfig, DEFAULT_CAMERA_BASE_URL, normalize_camera_base_url};
use connect::{
    ConnectFailKind, ConnectOutcome, ProfileDraft, SwitchBackOutcome, connect_camera, default_wait,
    maybe_switch_back_after_import, probe_http, save_and_connect, switch_back, tunnel_hint,
};
use error::AppError;
use importer::{
    FileImportStatus, ImportProgress as FileImportProgress, Importer, download_thumbnail,
};
use keychain::MacKeychain;
use profile::{
    CameraProfile, ProfileStore, WifiSession, delete_profile, save_profile, set_active_profile,
    set_auto_switch_back,
};
use wifi::SystemWifi;

/// The crate's UI set (`nsh.json` `"rust"`).
#[native_module("ricoh-mac/native")]
fn native(registry: &mut Registry) {
    registry
        .module::<Library>()
        .module::<Camera>()
        .module::<Wifi>();
}

fn data_directory() -> Result<PathBuf, AppError> {
    data_dir()
        .ok_or_else(|| AppError::msg("This host does not provide an application data directory"))
}

fn load_config() -> Result<AppConfig, AppError> {
    AppConfig::load(&data_directory()?)
}

fn save_config(config: &AppConfig) -> Result<(), AppError> {
    config.save(&data_directory()?)
}

/// Library folder and camera base URL.
#[module]
pub struct Library;

#[module]
impl Library {
    /// The saved library folder, if the user has chosen one.
    pub async fn folder() -> Result<Option<String>, String> {
        Ok(load_config()?.library_folder)
    }

    /// Open a folder picker and persist the chosen library folder.
    pub async fn pick_folder() -> Result<Option<String>, String> {
        let _data = data_directory()?;
        let picked = pick_paths(OpenDialog::folders().title("Choose library folder"));
        match picked.await {
            Ok(Some(paths)) => {
                let Some(path) = paths.into_iter().next() else {
                    return Ok(None);
                };
                let mut config = load_config()?;
                config.library_folder = Some(path.display().to_string());
                save_config(&config)?;
                Ok(Some(path.display().to_string()))
            }
            Ok(None) => Ok(None),
            Err(err) => Err(err),
        }
    }

    /// The camera HTTP origin. Defaults to `http://192.168.0.1`.
    pub async fn camera_base_url() -> Result<String, String> {
        Ok(load_config()?.camera_base_url)
    }

    /// Save a camera HTTP origin for development or an unusual camera address.
    pub async fn set_camera_base_url(url: String) -> Result<String, String> {
        let url = normalize_camera_base_url(&url)?;
        let mut config = load_config()?;
        config.camera_base_url = url.clone();
        save_config(&config)?;
        Ok(url)
    }

    /// Restore the default camera origin `http://192.168.0.1`.
    pub async fn reset_camera_base_url() -> Result<String, String> {
        Self::set_camera_base_url(DEFAULT_CAMERA_BASE_URL.to_string()).await
    }

    /// List photographs already imported into the library folder.
    ///
    /// The listing is read-only. It does not create, rewrite, move, or delete
    /// files, and it does not descend into subfolders.
    pub async fn list_photos() -> Result<Vec<LibraryPhoto>, String> {
        let folder = load_config()?
            .library_folder
            .ok_or_else(|| "请先选择保存位置。".to_string())?;
        let path = PathBuf::from(folder);
        let listed = blocking(move || list_imported_photos(&path))
            .await
            .map_err(|err| err.to_string())??;
        Ok(listed
            .into_iter()
            .map(|photo| LibraryPhoto {
                id: photo.file.clone(),
                file: photo.file,
                size: photo.size.map(|value| value as f64),
                path: photo.path.display().to_string(),
                preview_url: photo.previewable.then(|| file_url(&photo.path)),
            })
            .collect())
    }
}

/// A photograph already present in the library folder.
#[derive(Debug, Clone, JsObject)]
pub struct LibraryPhoto {
    /// File name, also used as the identifier in the single import folder.
    pub id: String,
    /// Original file name.
    pub file: String,
    /// Size in bytes, when known.
    pub size: Option<f64>,
    /// Absolute path on disk.
    pub path: String,
    /// `file:` URL for raster formats the image view can display. Absent for DNG in this version.
    pub preview_url: Option<String>,
}

/// Connection status returned to the UI.
#[derive(Debug, Clone, JsObject)]
pub struct ConnectionStatus {
    /// Whether the probe reached the camera.
    pub connected: bool,
    /// Model name, when properties were available.
    pub model: Option<String>,
    /// Serial number, when properties were available.
    pub serial: Option<String>,
    /// Firmware version, when properties were available.
    pub firmware: Option<String>,
    /// Human-readable status message.
    pub message: String,
    /// Base URL that was probed.
    pub base_url: String,
}

/// A photo listed on the camera.
#[derive(Debug, Clone, JsObject)]
pub struct PhotoItem {
    /// `folder/file`.
    pub id: String,
    /// Camera folder name.
    pub folder: String,
    /// Original file name.
    pub file: String,
    /// Size in bytes, when known.
    pub size: Option<f64>,
    /// Local thumbnail path, when already cached.
    pub thumbnail_path: Option<String>,
}

/// One file in an import batch.
#[derive(Debug, Clone, JsObject)]
pub struct ImportItem {
    /// Original file name.
    pub file: String,
    /// `imported`, `skipped`, `conflict`, or `error`.
    pub status: String,
    /// Detail for the UI.
    pub message: String,
}

/// Batch import result.
#[derive(Debug, Clone, JsObject)]
pub struct ImportReport {
    /// Number of newly saved files.
    pub imported: f64,
    /// Number of files already present with the same size.
    pub skipped: f64,
    /// Number of same-name conflicts that were left unchanged.
    pub conflicts: f64,
    /// Number of files that failed.
    pub errors: f64,
    /// Per-file outcomes.
    pub items: Vec<ImportItem>,
}

/// Progress of an import batch.
#[derive(Debug, Clone, JsObject)]
pub struct ImportProgress {
    /// 1-based index of the file just processed.
    pub current: f64,
    /// Total files in the batch.
    pub total: f64,
    /// File name being processed.
    pub file: String,
    /// `imported`, `skipped`, `conflict`, or `error`.
    pub status: String,
    /// Detail for the UI.
    pub message: String,
}

/// Camera probe, listing, and import.
#[module]
pub struct Camera;

#[module]
impl Camera {
    /// Probe `GET /v1/ping` and `GET /v1/props` on the configured base URL.
    pub async fn probe() -> Result<ConnectionStatus, String> {
        let config = load_config()?;
        let url = config.camera_base_url.clone();
        let result = blocking(move || CameraClient::new(url).probe())
            .await
            .map_err(|err| err.to_string())?;
        Ok(ConnectionStatus {
            connected: result.connected,
            model: result.props.model,
            serial: result.props.serial,
            firmware: result.props.firmware,
            message: result.message,
            base_url: config.camera_base_url,
        })
    }

    /// List photos with `GET /v1/photos`.
    pub async fn list_photos() -> Result<Vec<PhotoItem>, String> {
        let config = load_config()?;
        let url = config.camera_base_url.clone();
        let data = data_directory().ok();
        let photos = blocking(move || CameraClient::new(url).list_photos())
            .await
            .map_err(|err| err.to_string())?
            .map_err(|err| err.to_string())?;
        Ok(photos
            .into_iter()
            .map(|photo| PhotoItem {
                thumbnail_path: data
                    .as_ref()
                    .and_then(|dir| cached_thumb(dir, &photo))
                    .map(|path| path_url(&path)),
                id: photo.id(),
                folder: photo.folder,
                file: photo.file,
                size: photo.size.map(|n| n as f64),
            })
            .collect())
    }

    /// Download a `size=thumb` preview into the app data directory, when the camera serves one.
    pub async fn load_thumbnail(folder: String, file: String) -> Result<Option<String>, String> {
        let config = load_config()?;
        let url = config.camera_base_url.clone();
        let data = data_directory()?;
        let photo = CameraPhoto {
            folder,
            file,
            size: None,
        };
        let dest = thumb_path(&data, &photo);
        let result = blocking(move || {
            let client = CameraClient::new(url);
            download_thumbnail(&client, &photo, &dest)
        })
        .await
        .map_err(|err| err.to_string())?;
        match result {
            Ok(path) => Ok(Some(path_url(&path))),
            Err(_) => Ok(None),
        }
    }

    /// Import the selected `folder/file` ids into the library folder.
    pub async fn import_selected(
        ids: Vec<String>,
        on_progress: Callback<ImportProgress, ()>,
    ) -> Result<ImportReport, String> {
        import_ids(ids, on_progress).await
    }

    /// Import every photo currently listed on the camera.
    pub async fn import_all(
        on_progress: Callback<ImportProgress, ()>,
    ) -> Result<ImportReport, String> {
        let config = load_config()?;
        let url = config.camera_base_url.clone();
        let photos = blocking(move || CameraClient::new(url).list_photos())
            .await
            .map_err(|err| err.to_string())?
            .map_err(|err| err.to_string())?;
        let ids = photos.into_iter().map(|photo| photo.id()).collect();
        import_ids(ids, on_progress).await
    }
}

/// Result of a Wi-Fi connect or profile-capture attempt.
#[derive(Debug, Clone, JsObject)]
pub struct ConnectResult {
    /// `need_profile`, `connected`, or `failed`.
    pub kind: String,
    /// Message for the UI.
    pub message: String,
    /// Suggested SSID, when the current network or a saved profile is known.
    pub suggested_ssid: Option<String>,
    /// Whether the camera was already reachable before switching.
    pub already_on_camera: bool,
    /// Tunnel interface carrying the camera route, when detected.
    pub via_utun: Option<String>,
    /// Typed failure: `wrong_password`, `timeout`, `permission_denied`, `unreachable`, or `other`.
    pub fail_kind: Option<String>,
    /// Whether this attempt switched the system Wi-Fi.
    pub switched: bool,
    /// Network to restore after import or disconnect.
    pub previous_ssid: Option<String>,
    /// Whether the camera probe succeeded.
    pub connected: bool,
    /// Model name, when available.
    pub model: Option<String>,
    /// Serial number, when available.
    pub serial: Option<String>,
    /// Firmware version, when available.
    pub firmware: Option<String>,
    /// Camera HTTP origin that was used.
    pub base_url: String,
}

/// Saved camera profile metadata. The Wi-Fi password is never included.
#[derive(Debug, Clone, JsObject)]
pub struct ProfileView {
    /// Stable profile id.
    pub id: String,
    /// Camera model, when known.
    pub model: Option<String>,
    /// Camera serial, when known.
    pub serial: Option<String>,
    /// Firmware version, when known.
    pub firmware: Option<String>,
    /// Camera Wi-Fi SSID.
    pub ssid: String,
}

/// Settings and session state for the Wi-Fi panel.
#[derive(Debug, Clone, JsObject)]
pub struct WifiSettings {
    /// Active profile, when one is saved.
    pub profile: Option<ProfileView>,
    /// All saved camera profiles, most recently used first.
    pub profiles: Vec<ProfileView>,
    /// Switch back to the previous network after import by default.
    pub auto_switch_back: bool,
    /// Previous SSID remembered for this session.
    pub previous_ssid: Option<String>,
    /// Whether a switch-back can be performed now.
    pub can_switch_back: bool,
    /// Tunnel interface carrying the camera route, when detected.
    pub via_utun: Option<String>,
}

/// Result of switching back to the previous network.
#[derive(Debug, Clone, JsObject)]
pub struct SwitchBackResult {
    /// `restored`, `not_needed`, or `failed`.
    pub kind: String,
    /// Network that was restored, when applicable.
    pub ssid: Option<String>,
    /// Message for the UI.
    pub message: String,
}

fn fail_kind_name(kind: &ConnectFailKind) -> String {
    match kind {
        ConnectFailKind::WrongPassword => "wrong_password",
        ConnectFailKind::Timeout => "timeout",
        ConnectFailKind::PermissionDenied => "permission_denied",
        ConnectFailKind::Unreachable => "unreachable",
        ConnectFailKind::Other => "other",
    }
    .to_string()
}

fn connect_result(outcome: ConnectOutcome) -> ConnectResult {
    match outcome {
        ConnectOutcome::NeedProfile {
            suggested_ssid,
            already_on_camera,
            via_utun,
            message,
        } => ConnectResult {
            kind: "need_profile".to_string(),
            message,
            suggested_ssid,
            already_on_camera,
            via_utun,
            fail_kind: None,
            switched: false,
            previous_ssid: None,
            connected: already_on_camera,
            model: None,
            serial: None,
            firmware: None,
            base_url: String::new(),
        },
        ConnectOutcome::Connected {
            probe,
            switched,
            previous_ssid,
            via_utun,
        } => ConnectResult {
            kind: "connected".to_string(),
            message: probe.message.clone(),
            suggested_ssid: None,
            already_on_camera: !switched,
            via_utun,
            fail_kind: None,
            switched,
            previous_ssid,
            connected: probe.connected,
            model: probe.model,
            serial: probe.serial,
            firmware: probe.firmware,
            base_url: probe.base_url,
        },
        ConnectOutcome::Failed {
            message,
            via_utun,
            kind,
        } => ConnectResult {
            kind: "failed".to_string(),
            message,
            suggested_ssid: None,
            already_on_camera: false,
            via_utun,
            fail_kind: Some(fail_kind_name(&kind)),
            switched: false,
            previous_ssid: None,
            connected: false,
            model: None,
            serial: None,
            firmware: None,
            base_url: String::new(),
        },
    }
}

fn switch_back_result(outcome: SwitchBackOutcome) -> SwitchBackResult {
    match outcome {
        SwitchBackOutcome::Restored { ssid } => SwitchBackResult {
            kind: "restored".to_string(),
            ssid: Some(ssid.clone()),
            message: format!("已切回 {ssid}"),
        },
        SwitchBackOutcome::NotNeeded => SwitchBackResult {
            kind: "not_needed".to_string(),
            ssid: None,
            message: "当前不需要切回原来的网络。".to_string(),
        },
        SwitchBackOutcome::Failed { message } => SwitchBackResult {
            kind: "failed".to_string(),
            ssid: None,
            message,
        },
    }
}

fn profile_view(profile: &CameraProfile) -> ProfileView {
    ProfileView {
        id: profile.id.clone(),
        model: profile.model.clone(),
        serial: profile.serial.clone(),
        firmware: profile.firmware.clone(),
        ssid: profile.ssid.clone(),
    }
}

fn load_wifi_settings(dir: &Path) -> Result<WifiSettings, String> {
    let store = ProfileStore::load(dir)?;
    let session = WifiSession::load(dir)?;
    let via_utun = tunnel_hint(&SystemWifi);
    let mut listed = store.profiles.clone();
    listed.sort_by_key(|left| std::cmp::Reverse(left.last_used_at));
    Ok(WifiSettings {
        profile: store.active().map(profile_view),
        profiles: listed.iter().map(profile_view).collect(),
        auto_switch_back: store.auto_switch_back,
        previous_ssid: session.previous_ssid.clone(),
        can_switch_back: session.switched && session.previous_ssid.is_some(),
        via_utun,
    })
}

/// Camera Wi-Fi profiles, automatic switching, and switch-back.
#[module]
pub struct Wifi;

#[module]
impl Wifi {
    /// Connect using a saved profile, or report that a profile must be captured first.
    pub async fn connect() -> Result<ConnectResult, String> {
        let dir = data_directory()?;
        let url = load_config()?.camera_base_url;
        let outcome = blocking(move || {
            let secrets = MacKeychain::default();
            let wifi = SystemWifi;
            let probe_url = url.clone();
            connect_camera(&dir, &secrets, &wifi, &url, default_wait(), &|| {
                probe_http(&probe_url)
            })
        })
        .await
        .map_err(|err| err.to_string())?;
        Ok(connect_result(outcome))
    }

    /// Make a saved profile active, then connect using that profile.
    pub async fn connect_profile(id: String) -> Result<ConnectResult, String> {
        let dir = data_directory()?;
        blocking(move || set_active_profile(&dir, &id))
            .await
            .map_err(|err| err.to_string())??;
        Self::connect().await
    }
    /// Save a camera Wi-Fi profile and then connect, possibly switching networks.
    pub async fn save_and_connect(
        ssid: String,
        password: String,
        already_on_camera: bool,
    ) -> Result<ConnectResult, String> {
        let dir = data_directory()?;
        let url = load_config()?.camera_base_url;
        let outcome = blocking(move || {
            let secrets = MacKeychain::default();
            let wifi = SystemWifi;
            let probe_url = url.clone();
            let probe = || probe_http(&probe_url);
            let (model, serial, firmware) = if already_on_camera {
                match probe() {
                    Ok(result) => (
                        result.props.model,
                        result.props.serial,
                        result.props.firmware,
                    ),
                    Err(_) => (None, None, None),
                }
            } else {
                (None, None, None)
            };
            save_and_connect(
                &dir,
                &secrets,
                &wifi,
                &url,
                ProfileDraft {
                    ssid,
                    password,
                    model,
                    serial,
                    firmware,
                    already_on_camera,
                },
                default_wait(),
                &probe,
            )
        })
        .await
        .map_err(|err| err.to_string())?;
        Ok(connect_result(outcome))
    }

    /// Save or update the active profile without switching networks.
    pub async fn save_profile(ssid: String, password: String) -> Result<ProfileView, String> {
        let dir = data_directory()?;
        let url = load_config()?.camera_base_url;
        let profile = blocking(move || {
            let secrets = MacKeychain::default();
            let existing = ProfileStore::load(&dir)?.active().cloned();
            let profile = CameraProfile {
                id: existing
                    .as_ref()
                    .map(|item| item.id.clone())
                    .unwrap_or_default(),
                model: existing.as_ref().and_then(|item| item.model.clone()),
                serial: existing.as_ref().and_then(|item| item.serial.clone()),
                firmware: existing.as_ref().and_then(|item| item.firmware.clone()),
                ssid,
                base_url: url,
                created_at: existing.as_ref().map(|item| item.created_at).unwrap_or(0),
                last_used_at: 0,
            };
            save_profile(&dir, &secrets, profile, &password)
        })
        .await
        .map_err(|err| err.to_string())??;
        Ok(profile_view(&profile))
    }

    /// Current profile, auto-switch-back preference, and session.
    pub async fn settings() -> Result<WifiSettings, String> {
        let dir = data_directory()?;
        blocking(move || load_wifi_settings(&dir))
            .await
            .map_err(|err| err.to_string())?
    }

    /// Remember whether to switch back after import.
    pub async fn set_auto_switch_back(value: bool) -> Result<bool, String> {
        let dir = data_directory()?;
        let store = blocking(move || set_auto_switch_back(&dir, value))
            .await
            .map_err(|err| err.to_string())??;
        Ok(store.auto_switch_back)
    }

    /// Delete the active profile and its Keychain password.
    pub async fn delete_profile() -> Result<WifiSettings, String> {
        let dir = data_directory()?;
        blocking(move || {
            let secrets = MacKeychain::default();
            let store = ProfileStore::load(&dir)?;
            if let Some(profile) = store.active().cloned() {
                delete_profile(&dir, &secrets, &profile.id)?;
            }
            load_wifi_settings(&dir)
        })
        .await
        .map_err(|err| err.to_string())?
    }

    /// Switch back to the previous network after import or on request.
    pub async fn switch_back() -> Result<SwitchBackResult, String> {
        let dir = data_directory()?;
        let outcome = blocking(move || switch_back(&dir, &SystemWifi))
            .await
            .map_err(|err| err.to_string())?;
        Ok(switch_back_result(outcome))
    }

    /// Switch back after import when the user left auto-switch-back enabled.
    pub async fn switch_back_after_import() -> Result<SwitchBackResult, String> {
        let dir = data_directory()?;
        let outcome = blocking(move || maybe_switch_back_after_import(&dir, &SystemWifi))
            .await
            .map_err(|err| err.to_string())?;
        Ok(switch_back_result(outcome))
    }
}

async fn import_ids(
    ids: Vec<String>,
    on_progress: Callback<ImportProgress, ()>,
) -> Result<ImportReport, String> {
    let config = load_config()?;
    let library = config
        .library_folder
        .clone()
        .ok_or_else(|| "Choose a library folder before importing".to_string())?;
    let url = config.camera_base_url.clone();
    let listed = blocking({
        let url = url.clone();
        move || CameraClient::new(url).list_photos()
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(|err| err.to_string())?;

    let mut selected = Vec::new();
    for id in &ids {
        if let Some(photo) = listed.iter().find(|photo| &photo.id() == id) {
            selected.push(photo.clone());
        } else if let Some((folder, file)) = id.split_once('/') {
            selected.push(CameraPhoto {
                folder: folder.to_string(),
                file: file.to_string(),
                size: None,
            });
        } else {
            return Err(format!("Invalid photo id: {id}"));
        }
    }

    let mut items = Vec::new();
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut conflicts = 0usize;
    let mut errors = 0usize;
    let total = selected.len() as f64;
    for (index, photo) in selected.into_iter().enumerate() {
        let url = url.clone();
        let library = library.clone();
        let (one, file_progress) = blocking(move || {
            let client = CameraClient::new(url);
            let library_path = PathBuf::from(library);
            let mut file_progress = None;
            let summary =
                Importer::new(&library_path, &client).import_photos(&[photo], |progress| {
                    file_progress = Some(progress);
                });
            (summary, file_progress)
        })
        .await
        .map_err(|err| err.to_string())?;
        imported += one.imported();
        skipped += one.skipped();
        conflicts += one.conflicts();
        errors += one.errors();
        let result = one
            .results
            .into_iter()
            .next()
            .ok_or_else(|| "Import returned no result for a file".to_string())?;
        let FileImportProgress {
            current: file_current,
            total: _file_total,
            file,
            status,
            message,
        } = file_progress.unwrap_or(FileImportProgress {
            current: 1,
            total: 1,
            file: result.file.clone(),
            status: status_string(&result.status).to_string(),
            message: result.message.clone(),
        });
        let item = ImportItem {
            file: result.file.clone(),
            status: status_string(&result.status).to_string(),
            message: result.message.clone(),
        };
        // Single-file import reports 1/1; remap onto the outer batch index/total.
        on_progress.post(ImportProgress {
            current: (index as f64) + file_current as f64,
            total,
            file,
            status,
            message,
        });
        items.push(item);
    }

    Ok(ImportReport {
        imported: imported as f64,
        skipped: skipped as f64,
        conflicts: conflicts as f64,
        errors: errors as f64,
        items,
    })
}

fn status_string(status: &FileImportStatus) -> &'static str {
    match status {
        FileImportStatus::Imported => "imported",
        FileImportStatus::Skipped => "skipped",
        FileImportStatus::Conflict => "conflict",
        FileImportStatus::Error => "error",
    }
}

fn thumb_path(data_dir: &Path, photo: &CameraPhoto) -> PathBuf {
    let safe_folder = photo.folder.replace(['/', '\\'], "_");
    let safe_file = photo.file.replace(['/', '\\'], "_");
    data_dir
        .join("thumbs")
        .join(format!("{safe_folder}_{safe_file}.thumb"))
}

fn cached_thumb(data_dir: &Path, photo: &CameraPhoto) -> Option<PathBuf> {
    let path = thumb_path(data_dir, photo);
    path.is_file().then_some(path)
}

fn path_url(path: &Path) -> String {
    format!("file://{}", path.display())
}
