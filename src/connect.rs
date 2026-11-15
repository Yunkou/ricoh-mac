//! Connection flow: probe, optional Wi-Fi switch, profile capture, and switch-back.

use std::path::Path;
use std::time::Duration;

use crate::camera::{CameraClient, CameraError, CameraProps, ProbeResult};
use crate::keychain::SecretStore;
use crate::profile::{
    CameraProfile, ProfileStore, WifiSession, now_secs, profile_id, save_profile,
};
use crate::wifi::{WifiController, WifiError, is_tunnel_interface, wait_until};

const CAMERA_HOST: &str = "192.168.0.1";
const DEFAULT_WAIT: Duration = Duration::from_secs(20);

/// Result of a connect attempt, for the UI to act on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectOutcome {
    NeedProfile {
        suggested_ssid: Option<String>,
        already_on_camera: bool,
        via_utun: Option<String>,
        message: String,
    },
    Connected {
        probe: ProbeSnapshot,
        switched: bool,
        previous_ssid: Option<String>,
        via_utun: Option<String>,
    },
    Failed {
        message: String,
        via_utun: Option<String>,
        kind: ConnectFailKind,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectFailKind {
    WrongPassword,
    Timeout,
    PermissionDenied,
    Unreachable,
    Other,
}

/// Switch-back result.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SwitchBackOutcome {
    Restored { ssid: String },
    NotNeeded,
    Failed { message: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProbeSnapshot {
    pub connected: bool,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub firmware: Option<String>,
    pub message: String,
    pub base_url: String,
}

impl ProbeSnapshot {
    fn from_result(result: ProbeResult, base_url: &str) -> Self {
        Self {
            connected: result.connected,
            model: result.props.model,
            serial: result.props.serial,
            firmware: result.props.firmware,
            message: result.message,
            base_url: base_url.to_string(),
        }
    }
}

pub fn tunnel_hint(wifi: &impl WifiController) -> Option<String> {
    wifi.route_interface(CAMERA_HOST)
        .ok()
        .flatten()
        .filter(|iface| is_tunnel_interface(iface))
}

fn fail(kind: ConnectFailKind, message: String, via_utun: Option<String>) -> ConnectOutcome {
    ConnectOutcome::Failed {
        message,
        via_utun,
        kind,
    }
}

fn map_wifi_error(err: WifiError, via_utun: Option<String>) -> ConnectOutcome {
    let kind = match err {
        WifiError::WrongPassword => ConnectFailKind::WrongPassword,
        WifiError::Timeout => ConnectFailKind::Timeout,
        WifiError::PermissionDenied => ConnectFailKind::PermissionDenied,
        _ => ConnectFailKind::Other,
    };
    let mut message = err.message();
    if via_utun.is_some() && !message.contains("排除出代理") {
        message = utun_prefix(via_utun.as_deref()) + &message;
    }
    fail(kind, message, via_utun)
}

/// Probe the camera HTTP origin.
pub fn probe_http(base_url: &str) -> Result<ProbeResult, CameraError> {
    Ok(CameraClient::new(base_url.to_string())
        .with_timeouts(Duration::from_secs(3), Duration::from_secs(10))
        .probe())
}

fn wait_for_camera(
    probe: &impl Fn() -> Result<ProbeResult, CameraError>,
    timeout: Duration,
) -> Result<ProbeResult, WifiError> {
    let mut last: Option<CameraError> = None;
    wait_until(timeout, || match probe() {
        Ok(result) if result.connected => true,
        Ok(_) => false,
        Err(err) => {
            last = Some(err);
            false
        }
    })?;
    match probe() {
        Ok(result) => Ok(result),
        Err(err) => Err(WifiError::CommandFailed(err.to_string())),
    }
}

fn remember_identity(dir: &Path, props: &CameraProps) {
    let Ok(mut store) = ProfileStore::load(dir) else {
        return;
    };
    let index = store
        .active_profile_id
        .as_ref()
        .and_then(|id| store.profiles.iter().position(|item| &item.id == id))
        .or({
            if store.profiles.is_empty() {
                None
            } else {
                Some(0)
            }
        });
    let Some(index) = index else {
        return;
    };
    let profile = &mut store.profiles[index];
    if profile.model.is_none() {
        profile.model = props.model.clone();
    }
    if profile.serial.is_none() {
        profile.serial = props.serial.clone();
    }
    if profile.firmware.is_none() {
        profile.firmware = props.firmware.clone();
    }
    profile.last_used_at = now_secs();
    let _ = store.save(dir);
}

/// Connect: use a saved profile to switch Wi-Fi when needed, or ask for a first profile.
pub fn connect_camera(
    dir: &Path,
    secrets: &impl SecretStore,
    wifi: &impl WifiController,
    base_url: &str,
    wait: Duration,
    probe: &impl Fn() -> Result<ProbeResult, CameraError>,
) -> ConnectOutcome {
    let via_utun = tunnel_hint(wifi);
    let store = match ProfileStore::load(dir) {
        Ok(store) => store,
        Err(err) => return fail(ConnectFailKind::Other, err.to_string(), via_utun),
    };
    let current = wifi.current_ssid().ok().flatten();
    let immediate = probe();

    if let Ok(result) = &immediate
        && result.connected
    {
        if store.active().is_none() {
            return ConnectOutcome::NeedProfile {
                suggested_ssid: current,
                already_on_camera: true,
                via_utun,
                message: "已连接到相机。请保存相机屏幕上的网络名称和密码，以后就可以自动连接。"
                    .to_string(),
            };
        }
        remember_identity(dir, &result.props);
        let _ = WifiSession::clear(dir);
        return ConnectOutcome::Connected {
            probe: ProbeSnapshot::from_result(result.clone(), base_url),
            switched: false,
            previous_ssid: None,
            via_utun,
        };
    }

    let Some(profile) = store.active().cloned() else {
        return ConnectOutcome::NeedProfile {
            suggested_ssid: current,
            already_on_camera: false,
            via_utun: via_utun.clone(),
            message: utun_prefix(via_utun.as_deref())
                + "还没有保存过相机网络。请输入相机屏幕上的网络名称和密码，或先在系统设置中手动加入后再连接。",
        };
    };

    let password = match secrets.get_secret(&profile.id) {
        Ok(Some(password)) => password,
        Ok(None) => {
            return ConnectOutcome::NeedProfile {
                suggested_ssid: Some(profile.ssid),
                already_on_camera: false,
                via_utun: via_utun.clone(),
                message: "已保存过这台相机，但找不到密码。请重新输入密码。".to_string(),
            };
        }
        Err(err) => return fail(ConnectFailKind::Other, err.to_string(), via_utun),
    };

    let previous = current.filter(|ssid| ssid != &profile.ssid);
    if let Some(ssid) = &previous {
        let session = WifiSession {
            previous_ssid: Some(ssid.clone()),
            switched: false,
        };
        let _ = session.save(dir);
    }

    if let Err(err) = wifi.associate(&profile.ssid, Some(&password)) {
        return map_wifi_error(err, via_utun);
    }

    let session = WifiSession {
        previous_ssid: previous.clone(),
        switched: true,
    };
    let _ = session.save(dir);

    match wait_for_camera(probe, wait) {
        Ok(result) if result.connected => {
            remember_identity(dir, &result.props);
            ConnectOutcome::Connected {
                probe: ProbeSnapshot::from_result(result, base_url),
                switched: true,
                previous_ssid: previous,
                via_utun,
            }
        }
        Ok(_) => fail(
            ConnectFailKind::Unreachable,
            utun_prefix(via_utun.as_deref())
                + "已加入相机网络，但相机没有响应。请确认相机无线网络仍然打开。",
            via_utun,
        ),
        Err(err) => map_wifi_error(err, via_utun),
    }
}

/// Save credentials, optionally switch, then probe.
/// Fields collected before a profile is saved and a connection is attempted.
pub struct ProfileDraft {
    pub ssid: String,
    pub password: String,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub firmware: Option<String>,
    pub already_on_camera: bool,
}

pub fn save_and_connect(
    dir: &Path,
    secrets: &impl SecretStore,
    wifi: &impl WifiController,
    base_url: &str,
    draft: ProfileDraft,
    wait: Duration,
    probe: &impl Fn() -> Result<ProbeResult, CameraError>,
) -> ConnectOutcome {
    let via_utun = tunnel_hint(wifi);
    let profile = CameraProfile {
        id: profile_id(draft.serial.as_deref(), &draft.ssid),
        model: draft.model,
        serial: draft.serial,
        firmware: draft.firmware,
        ssid: draft.ssid,
        base_url: base_url.to_string(),
        created_at: now_secs(),
        last_used_at: now_secs(),
    };
    if let Err(err) = save_profile(dir, secrets, profile, &draft.password) {
        return fail(ConnectFailKind::Other, err.to_string(), via_utun);
    }
    if draft.already_on_camera {
        match probe() {
            Ok(result) if result.connected => {
                remember_identity(dir, &result.props);
                return ConnectOutcome::Connected {
                    probe: ProbeSnapshot::from_result(result, base_url),
                    switched: false,
                    previous_ssid: None,
                    via_utun,
                };
            }
            _ => {}
        }
    }
    connect_camera(dir, secrets, wifi, base_url, wait, probe)
}

pub fn switch_back(dir: &Path, wifi: &impl WifiController) -> SwitchBackOutcome {
    let session = match WifiSession::load(dir) {
        Ok(session) => session,
        Err(err) => {
            return SwitchBackOutcome::Failed {
                message: err.to_string(),
            };
        }
    };
    let Some(ssid) = session.previous_ssid.clone() else {
        return SwitchBackOutcome::NotNeeded;
    };
    if !session.switched {
        return SwitchBackOutcome::NotNeeded;
    }
    match wifi.associate(&ssid, None) {
        Ok(()) => {
            let _ = WifiSession::clear(dir);
            SwitchBackOutcome::Restored { ssid }
        }
        Err(_err) => SwitchBackOutcome::Failed {
            message: format!("无法切回 {ssid}，请在系统设置中手动切换。"),
        },
    }
}

pub fn maybe_switch_back_after_import(dir: &Path, wifi: &impl WifiController) -> SwitchBackOutcome {
    match ProfileStore::load(dir) {
        Ok(store) if store.auto_switch_back => switch_back(dir, wifi),
        Ok(_) => SwitchBackOutcome::NotNeeded,
        Err(err) => SwitchBackOutcome::Failed {
            message: err.to_string(),
        },
    }
}

fn utun_prefix(iface: Option<&str>) -> String {
    match iface {
        Some(_name) => {
            "网络似乎被代理占用，相机可能连不上。请把相机网络排除出代理后再试。 ".to_string()
        }
        None => String::new(),
    }
}

pub fn default_wait() -> Duration {
    DEFAULT_WAIT
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keychain::MemorySecrets;
    use crate::profile::save_profile;
    use crate::wifi::FakeWifi;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> std::path::PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "ricoh-mac-connect-{}-{}-{}",
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn profile(ssid: &str) -> CameraProfile {
        CameraProfile {
            id: String::new(),
            model: Some("RICOH GR IIIx".into()),
            serial: Some("S1".into()),
            firmware: Some("1.65".into()),
            ssid: ssid.into(),
            base_url: "http://192.168.0.1".into(),
            created_at: 0,
            last_used_at: 0,
        }
    }

    fn connected_result() -> ProbeResult {
        ProbeResult {
            connected: true,
            props: CameraProps {
                model: Some("RICOH GR IIIx".into()),
                serial: Some("S1".into()),
                firmware: Some("1.65".into()),
                manufacturer: None,
            },
            message: "Connected (RICOH GR IIIx)".into(),
        }
    }

    fn unreachable_err() -> CameraError {
        CameraError::new("unreachable")
    }

    #[test]
    fn first_successful_probe_asks_for_a_profile() {
        let dir = temp_dir();
        let secrets = MemorySecrets::default();
        let wifi = FakeWifi::new(Some("GR_NOW"));
        let outcome = connect_camera(
            &dir,
            &secrets,
            &wifi,
            "http://192.168.0.1",
            Duration::from_millis(200),
            &|| Ok(connected_result()),
        );
        match outcome {
            ConnectOutcome::NeedProfile {
                suggested_ssid,
                already_on_camera,
                ..
            } => {
                assert_eq!(suggested_ssid.as_deref(), Some("GR_NOW"));
                assert!(already_on_camera);
            }
            other => panic!("unexpected {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn saved_profile_switches_wifi_waits_and_connects() {
        let dir = temp_dir();
        let secrets = MemorySecrets::default();
        save_profile(&dir, &secrets, profile("GR_CAM"), "pw").unwrap();
        let wifi = FakeWifi::new(Some("HomeNet"));
        wifi.allow("GR_CAM", Some("pw"));
        wifi.allow("HomeNet", None);
        let reachable = Arc::new(AtomicBool::new(false));
        let flag = reachable.clone();
        wifi.on_join(move || flag.store(true, Ordering::SeqCst));
        let flag = reachable.clone();
        let outcome = connect_camera(
            &dir,
            &secrets,
            &wifi,
            "http://192.168.0.1",
            Duration::from_secs(2),
            &|| {
                if flag.load(Ordering::SeqCst) {
                    Ok(connected_result())
                } else {
                    Err(unreachable_err())
                }
            },
        );
        match outcome {
            ConnectOutcome::Connected {
                switched,
                previous_ssid,
                probe,
                ..
            } => {
                assert!(switched);
                assert_eq!(previous_ssid.as_deref(), Some("HomeNet"));
                assert!(probe.connected);
                assert_eq!(probe.serial.as_deref(), Some("S1"));
            }
            other => panic!("unexpected {other:?}"),
        }
        assert_eq!(wifi.joins.lock().unwrap().as_slice(), ["GR_CAM"]);
        let back = maybe_switch_back_after_import(&dir, &wifi);
        assert_eq!(
            back,
            SwitchBackOutcome::Restored {
                ssid: "HomeNet".into()
            }
        );
        assert_eq!(wifi.current_ssid().unwrap().as_deref(), Some("HomeNet"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn wrong_password_is_a_typed_failure() {
        let dir = temp_dir();
        let secrets = MemorySecrets::default();
        save_profile(&dir, &secrets, profile("GR_CAM"), "pw").unwrap();
        let wifi = FakeWifi::new(Some("HomeNet"));
        wifi.allow("GR_CAM", Some("other"));
        let outcome = connect_camera(
            &dir,
            &secrets,
            &wifi,
            "http://127.0.0.1:1",
            Duration::from_millis(50),
            &|| Err(unreachable_err()),
        );
        match outcome {
            ConnectOutcome::Failed { kind, .. } => assert_eq!(kind, ConnectFailKind::WrongPassword),
            other => panic!("unexpected {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn timeout_when_camera_does_not_answer_after_switch() {
        let dir = temp_dir();
        let secrets = MemorySecrets::default();
        save_profile(&dir, &secrets, profile("GR_CAM"), "pw").unwrap();
        let wifi = FakeWifi::new(Some("HomeNet"));
        wifi.allow("GR_CAM", Some("pw"));
        let outcome = connect_camera(
            &dir,
            &secrets,
            &wifi,
            "http://127.0.0.1:1",
            Duration::from_millis(300),
            &|| Err(unreachable_err()),
        );
        match outcome {
            ConnectOutcome::Failed { kind, .. } => assert_eq!(kind, ConnectFailKind::Timeout),
            other => panic!("unexpected {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn utun_route_is_reported_when_no_profile_exists() {
        let dir = temp_dir();
        let secrets = MemorySecrets::default();
        let wifi = FakeWifi::new(None);
        *wifi.route_iface.lock().unwrap() = Some("utun4".into());
        let outcome = connect_camera(
            &dir,
            &secrets,
            &wifi,
            "http://127.0.0.1:1",
            Duration::from_millis(50),
            &|| Err(unreachable_err()),
        );
        match outcome {
            ConnectOutcome::NeedProfile {
                via_utun, message, ..
            } => {
                assert_eq!(via_utun.as_deref(), Some("utun4"));
                assert!(message.contains("代理"));
                assert!(message.contains("排除出代理"));
            }
            other => panic!("unexpected {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn auto_switch_back_can_be_disabled() {
        let dir = temp_dir();
        let secrets = MemorySecrets::default();
        save_profile(&dir, &secrets, profile("GR_CAM"), "pw").unwrap();
        let mut store = ProfileStore::load(&dir).unwrap();
        store.auto_switch_back = false;
        store.save(&dir).unwrap();
        WifiSession {
            previous_ssid: Some("HomeNet".into()),
            switched: true,
        }
        .save(&dir)
        .unwrap();
        let wifi = FakeWifi::new(Some("GR_CAM"));
        wifi.allow("HomeNet", None);
        let outcome = maybe_switch_back_after_import(&dir, &wifi);
        assert_eq!(outcome, SwitchBackOutcome::NotNeeded);
        assert!(wifi.joins.lock().unwrap().is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
