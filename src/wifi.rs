//! Wi-Fi join and inspection for connecting to a GR IIIx.
//!
//! The production controller uses `networksetup` to join a known SSID and
//! password, and `route` to see whether 192.168.0.1 leaves through a `utun`
//! interface. Tests use `FakeWifi`. This module never prints passwords.

use std::process::Command;
use std::time::{Duration, Instant};

/// Failure while reading or changing Wi-Fi.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WifiError {
    PermissionDenied,
    WrongPassword,
    Timeout,
    InterfaceNotFound,
    CommandFailed(String),
}

impl std::fmt::Display for WifiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message())
    }
}

impl std::error::Error for WifiError {}

impl WifiError {
    pub fn message(&self) -> String {
        match self {
            Self::PermissionDenied => "没有读取当前 Wi-Fi 名称的权限。可在系统设置的「隐私与安全性 > 定位服务」中允许本应用，或手动输入相机屏幕上的网络名称。".to_string(),
            Self::WrongPassword => "无法加入相机 Wi-Fi，密码可能不正确。".to_string(),
            Self::Timeout => "等待相机网络超时。请确认相机无线局域网已打开。".to_string(),
            Self::InterfaceNotFound => "找不到本机的 Wi-Fi 接口。".to_string(),
            Self::CommandFailed(text) => text.clone(),
        }
    }
}

/// A Wi-Fi interface the app can inspect and join.
pub trait WifiController {
    fn current_ssid(&self) -> Result<Option<String>, WifiError>;
    fn associate(&self, ssid: &str, password: Option<&str>) -> Result<(), WifiError>;
    fn route_interface(&self, host: &str) -> Result<Option<String>, WifiError>;
}

/// An SSID is 1 to 32 bytes, with no control characters or NUL.
pub fn validate_ssid(ssid: &str) -> Result<&str, WifiError> {
    let ssid = ssid.trim();
    if ssid.is_empty() {
        return Err(WifiError::CommandFailed(
            "请填写相机 Wi-Fi 名称".to_string(),
        ));
    }
    if ssid.len() > 32 || ssid.bytes().any(|b| b < 0x20) {
        return Err(WifiError::CommandFailed("Wi-Fi 名称无效。".to_string()));
    }
    Ok(ssid)
}

/// A WPA password is 1 to 63 bytes and must not contain NUL.
pub fn validate_password(password: &str) -> Result<&str, WifiError> {
    if password.is_empty() {
        return Err(WifiError::CommandFailed(
            "请填写相机 Wi-Fi 密码".to_string(),
        ));
    }
    if password.len() > 63 || password.contains('\0') {
        return Err(WifiError::CommandFailed("Wi-Fi 密码无效。".to_string()));
    }
    Ok(password)
}

/// Interface names passed to `networksetup` must be simple identifiers such as `en0`.
pub fn validate_device_name(name: &str) -> Result<&str, WifiError> {
    let name = name.trim();
    let valid = name.len() <= 16
        && name.starts_with(|c: char| c.is_ascii_alphabetic())
        && name.chars().all(|c| c.is_ascii_alphanumeric());
    if valid {
        Ok(name)
    } else {
        Err(WifiError::InterfaceNotFound)
    }
}

/// `route` hosts in this app are IPv4 addresses such as `192.168.0.1`.
pub fn validate_route_host(host: &str) -> Result<&str, WifiError> {
    if host.parse::<std::net::Ipv4Addr>().is_ok() {
        Ok(host)
    } else {
        Err(WifiError::CommandFailed("无效的路由地址。".to_string()))
    }
}

/// Route to the camera goes through a userspace tunnel (for example Clash Verge).
pub fn is_tunnel_interface(name: &str) -> bool {
    let lower = name.trim().to_ascii_lowercase();
    lower.starts_with("utun") || lower.starts_with("tun") || lower == "utun"
}

pub fn parse_wifi_device(listallhardwareports: &str) -> Option<String> {
    let mut lines = listallhardwareports.lines();
    while let Some(line) = lines.next() {
        let line = line.trim();
        if (line.eq_ignore_ascii_case("Hardware Port: Wi-Fi")
            || line.eq_ignore_ascii_case("Hardware Port: AirPort")
            || line.contains("Hardware Port: Wi-Fi"))
            && let Some(device) = lines.next()
            && let Some(name) = device.trim().strip_prefix("Device:")
        {
            let name = name.trim();
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    None
}

pub fn parse_current_ssid(getairportnetwork: &str) -> Result<Option<String>, WifiError> {
    let text = getairportnetwork.trim();
    if text.is_empty() {
        return Ok(None);
    }
    let lower = text.to_ascii_lowercase();
    if lower.contains("not associated")
        || lower.contains("you are not associated")
        || lower.contains("no wifi")
    {
        return Ok(None);
    }
    if lower.contains("denied")
        || lower.contains("not authorized")
        || lower.contains("location") && lower.contains("permission")
    {
        return Err(WifiError::PermissionDenied);
    }
    if let Some(rest) = text.strip_prefix("Current Wi-Fi Network:") {
        let ssid = rest.trim();
        if ssid.is_empty() {
            return Ok(None);
        }
        return Ok(Some(ssid.to_string()));
    }
    if text.starts_with("Error") || text.starts_with("error") {
        return Err(WifiError::CommandFailed(text.to_string()));
    }
    Ok(None)
}

pub fn classify_join_output(stdout: &str, stderr: &str, success: bool) -> Result<(), WifiError> {
    let combined = format!("{stdout}\n{stderr}");
    let lower = combined.to_ascii_lowercase();
    if !success
        || lower.contains("invalid password")
        || lower.contains("wrong password")
        || lower.contains("incorrect password")
        || lower.contains("error: 0x")
        || lower.contains("failed to join")
        || lower.contains("could not join")
        || lower.contains("-3905")
        || lower.contains("-3900")
        || lower.contains("wpa") && lower.contains("fail")
    {
        if lower.contains("password")
            || lower.contains("-3905")
            || lower.contains("wpa")
            || lower.contains("authentication")
        {
            return Err(WifiError::WrongPassword);
        }
        if !success || lower.contains("failed") || lower.contains("error") {
            let detail = combined.trim();
            if detail.is_empty() {
                return Err(WifiError::CommandFailed("无法加入相机 Wi-Fi。".to_string()));
            }
            return Err(WifiError::CommandFailed(detail.to_string()));
        }
    }
    Ok(())
}

pub fn parse_route_interface(route_get: &str) -> Option<String> {
    for line in route_get.lines() {
        let line = line.trim();
        if let Some(name) = line.strip_prefix("interface:") {
            let name = name.trim();
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    None
}

/// In-memory controller for tests. It never touches the system Wi-Fi.
#[cfg(test)]
#[derive(Default)]
pub struct FakeWifi {
    pub ssid: std::sync::Mutex<Option<String>>,
    pub allowed: std::sync::Mutex<Vec<(String, Option<String>)>>,
    pub route_iface: std::sync::Mutex<Option<String>>,
    pub associate_delay: Duration,
    pub fail_with: std::sync::Mutex<Option<WifiError>>,
    pub joins: std::sync::Mutex<Vec<String>>,
    pub on_join: std::sync::Mutex<Option<std::sync::Arc<dyn Fn() + Send + Sync>>>,
}

#[cfg(test)]
impl FakeWifi {
    pub fn new(ssid: Option<&str>) -> Self {
        Self {
            ssid: std::sync::Mutex::new(ssid.map(str::to_string)),
            allowed: std::sync::Mutex::new(Vec::new()),
            route_iface: std::sync::Mutex::new(None),
            associate_delay: Duration::from_millis(0),
            fail_with: std::sync::Mutex::new(None),
            joins: std::sync::Mutex::new(Vec::new()),
            on_join: std::sync::Mutex::new(None),
        }
    }

    pub fn allow(&self, ssid: &str, password: Option<&str>) {
        self.allowed
            .lock()
            .unwrap()
            .push((ssid.to_string(), password.map(str::to_string)));
    }

    pub fn on_join(&self, hook: impl Fn() + Send + Sync + 'static) {
        *self.on_join.lock().unwrap() = Some(std::sync::Arc::new(hook));
    }
}

#[cfg(test)]
impl WifiController for FakeWifi {
    fn current_ssid(&self) -> Result<Option<String>, WifiError> {
        if let Some(err) = self.fail_with.lock().unwrap().clone() {
            return Err(err);
        }
        Ok(self.ssid.lock().unwrap().clone())
    }

    fn associate(&self, ssid: &str, password: Option<&str>) -> Result<(), WifiError> {
        if let Some(err) = self.fail_with.lock().unwrap().clone() {
            return Err(err);
        }
        if !self.associate_delay.is_zero() {
            std::thread::sleep(self.associate_delay);
        }
        let allowed = self.allowed.lock().unwrap();
        let ok = allowed.is_empty()
            || allowed.iter().any(|(name, pass)| {
                name == ssid
                    && match (pass, password) {
                        (None, _) => true,
                        (Some(expected), Some(got)) => expected == got,
                        (Some(_), None) => false,
                    }
            });
        if !ok {
            return Err(WifiError::WrongPassword);
        }
        self.joins.lock().unwrap().push(ssid.to_string());
        *self.ssid.lock().unwrap() = Some(ssid.to_string());
        let hook = self.on_join.lock().unwrap().clone();
        if let Some(hook) = hook {
            hook();
        }
        Ok(())
    }

    fn route_interface(&self, _host: &str) -> Result<Option<String>, WifiError> {
        Ok(self.route_iface.lock().unwrap().clone())
    }
}

/// Production controller. It calls system tools; tests should use `FakeWifi`.
pub struct SystemWifi;

impl SystemWifi {
    fn wifi_device(&self) -> Result<String, WifiError> {
        let output = Command::new("/usr/sbin/networksetup")
            .arg("-listallhardwareports")
            .output()
            .map_err(|err| WifiError::CommandFailed(err.to_string()))?;
        let text = String::from_utf8_lossy(&output.stdout);
        let name = parse_wifi_device(&text).ok_or(WifiError::InterfaceNotFound)?;
        validate_device_name(&name).map(|name| name.to_string())
    }
}

impl WifiController for SystemWifi {
    fn current_ssid(&self) -> Result<Option<String>, WifiError> {
        let device = self.wifi_device()?;
        let output = Command::new("/usr/sbin/networksetup")
            .arg("-getairportnetwork")
            .arg(&device)
            .output()
            .map_err(|err| WifiError::CommandFailed(err.to_string()))?;
        let text = format!(
            "{}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        parse_current_ssid(&text)
    }

    fn associate(&self, ssid: &str, password: Option<&str>) -> Result<(), WifiError> {
        if std::env::var_os("RICOH_MAC_NO_WIFI_SWITCH").is_some() {
            return Err(WifiError::CommandFailed(
                "已设置 RICOH_MAC_NO_WIFI_SWITCH，不会切换系统 Wi-Fi。".to_string(),
            ));
        }
        let device = self.wifi_device()?;
        let ssid = validate_ssid(ssid)?;
        let password = match password {
            Some(password) => Some(validate_password(password)?),
            None => None,
        };
        let mut command = Command::new("/usr/sbin/networksetup");
        command.arg("-setairportnetwork").arg(&device).arg(ssid);
        if let Some(password) = password {
            command.arg(password);
        }
        let output = command
            .output()
            .map_err(|err| WifiError::CommandFailed(err.to_string()))?;
        classify_join_output(
            &String::from_utf8_lossy(&output.stdout),
            &String::from_utf8_lossy(&output.stderr),
            output.status.success(),
        )
    }

    fn route_interface(&self, host: &str) -> Result<Option<String>, WifiError> {
        let host = validate_route_host(host)?;
        let output = Command::new("/sbin/route")
            .args(["-n", "get", host])
            .output()
            .map_err(|err| WifiError::CommandFailed(err.to_string()))?;
        let text = String::from_utf8_lossy(&output.stdout);
        Ok(parse_route_interface(&text))
    }
}

/// Poll `ready` until it returns true or `timeout` elapses.
pub fn wait_until(timeout: Duration, mut ready: impl FnMut() -> bool) -> Result<(), WifiError> {
    let started = Instant::now();
    loop {
        if ready() {
            return Ok(());
        }
        if started.elapsed() >= timeout {
            return Err(WifiError::Timeout);
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hardware_port_and_ssid() {
        let ports = "Hardware Port: Ethernet\nDevice: en1\nEthernet Address: aa\n\nHardware Port: Wi-Fi\nDevice: en0\nEthernet Address: bb\n";
        assert_eq!(parse_wifi_device(ports).as_deref(), Some("en0"));
        assert_eq!(
            parse_current_ssid("Current Wi-Fi Network: GR_ABCD")
                .unwrap()
                .as_deref(),
            Some("GR_ABCD")
        );
        assert_eq!(
            parse_current_ssid("You are not associated with an AirPort network.").unwrap(),
            None
        );
        assert!(matches!(
            parse_current_ssid("Error: Location permission denied"),
            Err(WifiError::PermissionDenied)
        ));
    }

    #[test]
    fn classifies_join_failures() {
        assert!(matches!(
            classify_join_output("", "Error: Invalid password -3905", false),
            Err(WifiError::WrongPassword)
        ));
        assert!(classify_join_output("", "", true).is_ok());
    }

    #[test]
    fn detects_utun_routes() {
        let text = "   route to: 192.168.0.1\ndestination: 192.168.0.1\n  interface: utun4\n      flags: <UP>";
        assert_eq!(parse_route_interface(text).as_deref(), Some("utun4"));
        assert!(is_tunnel_interface("utun4"));
        assert!(!is_tunnel_interface("en0"));
    }

    #[test]
    fn rejects_invalid_ssid_password_device_and_host() {
        assert!(validate_ssid("").is_err());
        assert!(validate_ssid("ok").is_ok());
        assert!(validate_ssid(&"x".repeat(33)).is_err());
        assert!(validate_ssid("bad\u{0001}name").is_err());
        assert!(validate_password("").is_err());
        assert!(validate_password("secret").is_ok());
        assert!(validate_password(&"p".repeat(64)).is_err());
        assert!(validate_device_name("en0").is_ok());
        assert!(validate_device_name("-setairportnetwork").is_err());
        assert!(validate_device_name("en0;rm").is_err());
        assert!(validate_route_host("192.168.0.1").is_ok());
        assert!(validate_route_host("example.com; rm -rf /").is_err());
    }

    #[test]
    fn fake_wifi_associates_only_with_allowed_password() {
        let wifi = FakeWifi::new(Some("Home"));
        wifi.allow("GR_X", Some("secret"));
        assert!(wifi.associate("GR_X", Some("nope")).is_err());
        wifi.associate("GR_X", Some("secret")).unwrap();
        assert_eq!(wifi.current_ssid().unwrap().as_deref(), Some("GR_X"));
        assert_eq!(wifi.joins.lock().unwrap().as_slice(), ["GR_X"]);
    }
}
