//! Read-only HTTP client for the community-documented GR IIIx Wi-Fi API.
//!
//! Endpoints and JSON shapes come from public community sources and have not
//! been validated on a real camera. The client never issues POST or PUT
//! requests, so it does not change camera state.

use std::io::{Read, Write};
use std::time::Duration;

use serde_json::Value;

/// A photo listed on the camera.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CameraPhoto {
    /// Camera folder name, for example `100RICOH`.
    pub folder: String,
    /// Original file name, for example `R0000001.JPG`.
    pub file: String,
    /// Size in bytes, when the list (or a later HEAD/GET) reports it.
    pub size: Option<u64>,
}

impl CameraPhoto {
    /// Stable id used by the UI and the importer: `folder/file`.
    pub fn id(&self) -> String {
        format!("{}/{}", self.folder, self.file)
    }
}

/// Identity fields extracted from `GET /v1/props`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CameraProps {
    pub model: Option<String>,
    pub serial: Option<String>,
    pub firmware: Option<String>,
    pub manufacturer: Option<String>,
}

/// Result of a reachability probe.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProbeResult {
    pub connected: bool,
    pub props: CameraProps,
    pub message: String,
}

/// Errors from a camera request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CameraError {
    pub message: String,
}

impl CameraError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for CameraError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for CameraError {}

/// Read-only camera HTTP client.
#[derive(Debug, Clone)]
pub struct CameraClient {
    base_url: String,
    connect_timeout: Duration,
    request_timeout: Duration,
}

impl CameraClient {
    /// Create a client for `base_url`, which is a camera origin such as `http://192.168.0.1`.
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: normalize_base(&base_url.into()),
            connect_timeout: Duration::from_secs(3),
            request_timeout: Duration::from_secs(60),
        }
    }

    pub fn with_timeouts(mut self, connect: Duration, request: Duration) -> Self {
        self.connect_timeout = connect;
        self.request_timeout = request;
        self
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// `GET /v1/ping`. Any HTTP 2xx response counts as success.
    pub fn ping(&self) -> Result<(), CameraError> {
        let url = self.v1_url("ping");
        let response = self.get(&url)?;
        if !is_success(response.status()) {
            return Err(CameraError::new(format!(
                "GET /v1/ping returned HTTP {}",
                response.status()
            )));
        }
        Ok(())
    }

    /// `GET /v1/props`. Unknown fields are ignored; model and firmware are
    /// taken from common community names when present.
    pub fn props(&self) -> Result<CameraProps, CameraError> {
        let url = self.v1_url("props");
        let response = self.get(&url)?;
        if !is_success(response.status()) {
            return Err(CameraError::new(format!(
                "GET /v1/props returned HTTP {}",
                response.status()
            )));
        }
        let body = read_text(response)?;
        let value: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
        Ok(parse_props(&value))
    }

    /// Probe reachability and, when ping succeeds, read properties.
    pub fn probe(&self) -> ProbeResult {
        match self.ping() {
            Ok(()) => match self.props() {
                Ok(props) => {
                    let model = props
                        .model
                        .clone()
                        .unwrap_or_else(|| "Unknown model".to_string());
                    ProbeResult {
                        connected: true,
                        props,
                        message: format!("Connected ({model})"),
                    }
                }
                Err(err) => ProbeResult {
                    connected: true,
                    props: CameraProps::default(),
                    message: format!("Connected, but properties could not be read: {err}"),
                },
            },
            Err(err) => ProbeResult {
                connected: false,
                props: CameraProps::default(),
                message: format!("Not connected: {err}"),
            },
        }
    }

    /// `GET /v1/photos`. The community OpenAPI shape is `{ "dirs": [ { "name", "files" } ] }`.
    /// The parser also accepts a top-level array of folders, and file entries
    /// that are either names or objects with a name and optional size.
    pub fn list_photos(&self) -> Result<Vec<CameraPhoto>, CameraError> {
        let url = self.v1_url("photos");
        let response = self.get(&url)?;
        if !is_success(response.status()) {
            return Err(CameraError::new(format!(
                "GET /v1/photos returned HTTP {}",
                response.status()
            )));
        }
        let body = read_text(response)?;
        let value: Value = serde_json::from_str(&body)
            .map_err(|err| CameraError::new(format!("GET /v1/photos is not valid JSON: {err}")))?;
        parse_photo_list(&value).map_err(CameraError::new)
    }

    /// Download a file (or a `size` variant such as `thumb`) into `writer`.
    ///
    /// When `resume_from` is greater than zero, a `Range` header is sent. If
    /// the camera answers 206, only the remaining bytes are written. If it
    /// answers 200, the writer is expected to have been reset by the caller
    /// and the full body is written. HTTP 416 or a missing Range
    /// implementation is reported so the importer can start again.
    pub fn download_to<W: Write>(
        &self,
        photo: &CameraPhoto,
        size: Option<&str>,
        resume_from: u64,
        writer: &mut W,
    ) -> Result<DownloadMeta, CameraError> {
        let mut path = format!(
            "photos/{}/{}",
            encode_segment(&photo.folder),
            encode_segment(&photo.file)
        );
        if let Some(size) = size {
            path.push_str("?size=");
            path.push_str(&encode_segment(size));
        }
        let url = self.v1_url(&path);
        let request = self.agent().get(&url);
        let request = if resume_from > 0 {
            request.set("Range", &format!("bytes={resume_from}-"))
        } else {
            request
        };
        let response = request
            .call()
            .map_err(|err| CameraError::new(format_ureq_error(&err)))?;
        let status = response.status();
        if status == 416 {
            return Err(CameraError::new(
                "The camera rejected the HTTP Range request (416)".to_string(),
            ));
        }
        if !is_success(status) {
            return Err(CameraError::new(format!(
                "GET {path} returned HTTP {status}"
            )));
        }
        let content_length = response
            .header("Content-Length")
            .and_then(|value| value.parse::<u64>().ok());
        let mut body = response.into_reader();
        let copied = std::io::copy(&mut body, writer)
            .map_err(|err| CameraError::new(format!("Download failed: {err}")))?;
        Ok(DownloadMeta {
            status,
            bytes_written: copied,
            content_length,
            resumed: resume_from > 0 && status == 206,
        })
    }

    /// Optional size from `HEAD` or from `GET /v1/photos/{folder}/{file}/info`.
    /// Returns `None` when neither source reports a size. Never required for import.
    pub fn file_size(&self, photo: &CameraPhoto) -> Option<u64> {
        if let Some(size) = photo.size {
            return Some(size);
        }
        if let Ok(size) = self.head_size(photo) {
            return size;
        }
        self.info_size(photo).ok().flatten()
    }

    fn head_size(&self, photo: &CameraPhoto) -> Result<Option<u64>, CameraError> {
        let path = format!(
            "photos/{}/{}",
            encode_segment(&photo.folder),
            encode_segment(&photo.file)
        );
        let url = self.v1_url(&path);
        let response = self
            .agent()
            .request("HEAD", &url)
            .call()
            .map_err(|err| CameraError::new(format_ureq_error(&err)))?;
        if !is_success(response.status()) {
            return Ok(None);
        }
        Ok(response
            .header("Content-Length")
            .and_then(|v| v.parse().ok()))
    }

    fn info_size(&self, photo: &CameraPhoto) -> Result<Option<u64>, CameraError> {
        let path = format!(
            "photos/{}/{}/info",
            encode_segment(&photo.folder),
            encode_segment(&photo.file)
        );
        let url = self.v1_url(&path);
        let response = self.get(&url)?;
        if !is_success(response.status()) {
            return Ok(None);
        }
        let body = read_text(response)?;
        let value: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
        Ok(value
            .get("size")
            .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|n| n as u64))))
    }

    fn agent(&self) -> ureq::Agent {
        ureq::AgentBuilder::new()
            .timeout_connect(self.connect_timeout)
            .timeout(self.request_timeout)
            .redirects(0)
            .user_agent("ricoh-mac/0.1")
            .build()
    }

    fn get(&self, url: &str) -> Result<ureq::Response, CameraError> {
        self.agent()
            .get(url)
            .call()
            .map_err(|err| CameraError::new(format_ureq_error(&err)))
    }

    fn v1_url(&self, path: &str) -> String {
        join_v1(self.base_url(), path)
    }
}

/// Metadata from a download response.
#[derive(Debug, Clone)]
pub struct DownloadMeta {
    pub status: u16,
    pub bytes_written: u64,
    pub content_length: Option<u64>,
    pub resumed: bool,
}

/// Build `http://host/v1/{path}` from an origin that may already include `/v1`.
pub fn join_v1(base: &str, path: &str) -> String {
    let base = normalize_base(base);
    let path = path.trim_start_matches('/');
    format!("{base}/v1/{path}")
}

fn normalize_base(base: &str) -> String {
    let trimmed = base.trim().trim_end_matches('/');
    if let Some(stripped) = trimmed.strip_suffix("/v1") {
        stripped.trim_end_matches('/').to_string()
    } else {
        trimmed.to_string()
    }
}

fn is_success(status: u16) -> bool {
    (200..300).contains(&status)
}

fn read_text(response: ureq::Response) -> Result<String, CameraError> {
    response
        .into_string()
        .map_err(|err| CameraError::new(format!("Could not read response body: {err}")))
}

fn format_ureq_error(err: &ureq::Error) -> String {
    match err {
        ureq::Error::Status(code, response) => {
            let url = response.get_url().to_string();
            format!("HTTP {code} from {url}")
        }
        ureq::Error::Transport(transport) => format!("{transport}"),
    }
}

fn parse_props(value: &Value) -> CameraProps {
    let model = first_string(
        value,
        &[
            "model",
            "cameraModel",
            "camera_model",
            "productName",
            "ProductName",
        ],
    );
    let firmware = first_string(
        value,
        &["firmwareVersion", "firmware", "fw", "FirmwareVersion"],
    );
    let manufacturer = first_string(value, &["manufacturer", "maker", "Manufacturer"]);
    let serial = first_string(
        value,
        &[
            "serial",
            "serialNumber",
            "serial_number",
            "SerialNumber",
            "bodySerial",
            "cameraSerial",
        ],
    );
    CameraProps {
        model,
        serial,
        firmware,
        manufacturer,
    }
}

fn first_string(value: &Value, keys: &[&str]) -> Option<String> {
    if let Some(obj) = value.as_object() {
        for key in keys {
            if let Some(text) = obj.get(*key).and_then(Value::as_str) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

fn parse_photo_list(value: &Value) -> Result<Vec<CameraPhoto>, String> {
    let dirs = if let Some(dirs) = value.get("dirs").and_then(Value::as_array) {
        dirs.clone()
    } else if let Some(dirs) = value.as_array() {
        dirs.clone()
    } else {
        return Err(
            "GET /v1/photos JSON does not match a known folder-list shape (expected { dirs: [...] } or an array)"
                .to_string(),
        );
    };
    let mut photos = Vec::new();
    for dir in dirs {
        let folder = dir
            .get("name")
            .and_then(Value::as_str)
            .or_else(|| dir.get("folder").and_then(Value::as_str))
            .or_else(|| dir.get("n").and_then(Value::as_str))
            .ok_or_else(|| "A folder entry in GET /v1/photos is missing a name".to_string())?
            .to_string();
        let files = dir
            .get("files")
            .and_then(Value::as_array)
            .ok_or_else(|| format!("Folder {folder} has no files array"))?;
        for file in files {
            let (name, size) = parse_file_entry(file)?;
            photos.push(CameraPhoto {
                folder: folder.clone(),
                file: name,
                size,
            });
        }
    }
    Ok(photos)
}

fn parse_file_entry(value: &Value) -> Result<(String, Option<u64>), String> {
    if let Some(name) = value.as_str() {
        return Ok((name.to_string(), None));
    }
    if let Some(obj) = value.as_object() {
        let name = obj
            .get("name")
            .and_then(Value::as_str)
            .or_else(|| obj.get("file").and_then(Value::as_str))
            .or_else(|| obj.get("filename").and_then(Value::as_str))
            .ok_or_else(|| "A file entry is missing a name".to_string())?
            .to_string();
        let size = obj
            .get("size")
            .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|n| n as u64)));
        return Ok((name, size));
    }
    Err("A file entry is neither a name nor an object".to_string())
}

fn encode_segment(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

// Silence unused import warning if Read is only used via into_reader internally.
#[allow(dead_code)]
fn _read_trait(_: &dyn Read) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_v1_accepts_origin_or_v1_suffix() {
        assert_eq!(
            join_v1("http://192.168.0.1", "ping"),
            "http://192.168.0.1/v1/ping"
        );
        assert_eq!(
            join_v1("http://192.168.0.1/v1/", "photos"),
            "http://192.168.0.1/v1/photos"
        );
    }

    #[test]
    fn parse_openapi_photo_list() {
        let value = serde_json::json!({
            "dirs": [
                { "name": "100RICOH", "files": ["R0000001.JPG", "R0000001.DNG"] }
            ]
        });
        let photos = parse_photo_list(&value).unwrap();
        assert_eq!(photos.len(), 2);
        assert_eq!(photos[0].folder, "100RICOH");
        assert_eq!(photos[0].file, "R0000001.JPG");
        assert_eq!(photos[1].file, "R0000001.DNG");
    }

    #[test]
    fn parse_file_objects_with_sizes() {
        let value = serde_json::json!([
            { "name": "100RICOH", "files": [ { "name": "R0000001.JPG", "size": 1234 } ] }
        ]);
        let photos = parse_photo_list(&value).unwrap();
        assert_eq!(photos[0].size, Some(1234));
    }

    #[test]
    fn parse_props_reads_common_keys() {
        let value = serde_json::json!({
            "model": "RICOH GR IIIx",
            "firmwareVersion": "1.65",
            "serialNumber": "00112233",
            "manufacturer": "RICOH IMAGING COMPANY, LTD."
        });
        let props = parse_props(&value);
        assert_eq!(props.model.as_deref(), Some("RICOH GR IIIx"));
        assert_eq!(props.firmware.as_deref(), Some("1.65"));
        assert_eq!(props.serial.as_deref(), Some("00112233"));
    }
}
