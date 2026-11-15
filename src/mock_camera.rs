//! A local HTTP fixture that speaks the community GR IIIx `/v1` read-only paths.
//!
//! The fixture is for development and tests. It is not a camera, and it does
//! not claim to reproduce firmware behavior.

use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

/// In-memory file served by the mock camera.
#[derive(Debug, Clone)]
pub struct MockFile {
    pub folder: String,
    pub file: String,
    pub body: Vec<u8>,
    pub thumb: Vec<u8>,
}

/// Runtime behavior of the mock camera.
#[derive(Debug, Clone)]
pub struct MockConfig {
    pub model: String,
    pub firmware: String,
    pub support_range: bool,
    pub files: Vec<MockFile>,
}

impl Default for MockConfig {
    fn default() -> Self {
        Self::with_file_count(2)
    }
}

impl MockConfig {
    /// Build a fixture with `count` photos in `100RICOH`.
    pub fn with_file_count(count: usize) -> Self {
        let mut files = Vec::with_capacity(count);
        for index in 1..=count {
            let name = format!("R{index:07}");
            let ext = if index % 2 == 0 { "DNG" } else { "JPG" };
            let file = format!("{name}.{ext}");
            let kind = if ext == "DNG" { "DNG" } else { "JPEG" };
            files.push(MockFile {
                folder: "100RICOH".to_string(),
                file,
                body: bytes_of(
                    &format!("{kind}-{name}"),
                    if ext == "DNG" { 16 * 1024 } else { 8 * 1024 },
                ),
                thumb: bytes_of(&format!("THUMB-{name}"), 256),
            });
        }
        Self {
            model: "RICOH GR IIIx".to_string(),
            firmware: "1.65".to_string(),
            support_range: true,
            files,
        }
    }
}

/// A running mock server on 127.0.0.1 with an ephemeral or chosen port.
pub struct MockServer {
    addr: SocketAddr,
    shutdown: Arc<Mutex<bool>>,
    handle: Option<JoinHandle<()>>,
    config: Arc<Mutex<MockConfig>>,
}

impl MockServer {
    /// Bind `127.0.0.1:0` (or `bind`) and serve requests on a background thread.
    pub fn start(config: MockConfig) -> std::io::Result<Self> {
        Self::bind("127.0.0.1:0", config)
    }

    pub fn bind(bind: &str, config: MockConfig) -> std::io::Result<Self> {
        let listener = TcpListener::bind(bind)?;
        listener.set_nonblocking(false)?;
        let addr = listener.local_addr()?;
        let shutdown = Arc::new(Mutex::new(false));
        let config = Arc::new(Mutex::new(config));
        let shutdown_flag = shutdown.clone();
        let config_flag = config.clone();
        let handle = thread::spawn(move || accept_loop(listener, shutdown_flag, config_flag));
        // Give the thread a moment to start listening.
        thread::sleep(Duration::from_millis(20));
        Ok(Self {
            addr,
            shutdown,
            handle: Some(handle),
            config,
        })
    }

    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    /// Origin such as `http://127.0.0.1:12345`.
    pub fn base_url(&self) -> String {
        format!("http://{}", self.addr)
    }

    pub fn set_support_range(&self, value: bool) {
        self.config.lock().unwrap().support_range = value;
    }

    pub fn shutdown(&self) {
        if let Ok(mut flag) = self.shutdown.lock() {
            *flag = true;
        }
        // Wake the accept loop by connecting once.
        let _ = TcpStream::connect_timeout(&self.addr, Duration::from_millis(100));
    }
}

impl Drop for MockServer {
    fn drop(&mut self) {
        self.shutdown();
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

fn bytes_of(tag: &str, len: usize) -> Vec<u8> {
    let mut body = tag.as_bytes().to_vec();
    body.resize(len, b'X');
    body
}

fn accept_loop(listener: TcpListener, shutdown: Arc<Mutex<bool>>, config: Arc<Mutex<MockConfig>>) {
    listener
        .set_nonblocking(true)
        .expect("set nonblocking on mock listener");
    loop {
        if shutdown.lock().map(|flag| *flag).unwrap_or(true) {
            break;
        }
        match listener.accept() {
            Ok((stream, _)) => {
                let config = config.clone();
                thread::spawn(move || {
                    if let Err(err) = handle_connection(stream, config) {
                        eprintln!("mock camera: {err}");
                    }
                });
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(10));
            }
            Err(_) => break,
        }
    }
}

fn handle_connection(mut stream: TcpStream, config: Arc<Mutex<MockConfig>>) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(2)))?;
    stream.set_write_timeout(Some(Duration::from_secs(2)))?;
    let mut buf = [0u8; 16 * 1024];
    let n = stream.read(&mut buf)?;
    if n == 0 {
        return Ok(());
    }
    let request = String::from_utf8_lossy(&buf[..n]);
    let mut lines = request.split("\r\n");
    let request_line = lines.next().unwrap_or("");
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("/").to_string();
    let mut headers = BTreeMap::new();
    for line in lines {
        if line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }
    let (path, query) = split_target(&target);
    let cfg = config.lock().unwrap().clone();
    let (status, content_type, body) = dispatch(&method, path, query, &headers, &cfg);
    write_response(&mut stream, status, content_type, &body)
}

fn split_target(target: &str) -> (&str, BTreeMap<String, String>) {
    match target.split_once('?') {
        Some((path, query)) => (path, parse_query(query)),
        None => (target, BTreeMap::new()),
    }
}

fn parse_query(query: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            map.insert(k.to_string(), v.to_string());
        } else if !pair.is_empty() {
            map.insert(pair.to_string(), String::new());
        }
    }
    map
}

fn dispatch(
    method: &str,
    path: &str,
    query: BTreeMap<String, String>,
    headers: &BTreeMap<String, String>,
    cfg: &MockConfig,
) -> (u16, &'static str, Vec<u8>) {
    if method != "GET" && method != "HEAD" {
        return (
            405,
            "application/json",
            br#"{"errCode":405,"errMsg":"Method not allowed"}"#.to_vec(),
        );
    }
    if path == "/v1/ping" {
        return json(200, r#"{"errCode":200,"errMsg":"OK"}"#);
    }
    if path == "/v1/props" {
        let body = format!(
            r#"{{"manufacturer":"RICOH IMAGING COMPANY, LTD.","model":"{}","firmwareVersion":"{}"}}"#,
            cfg.model, cfg.firmware
        );
        return json(200, &body);
    }
    if path == "/v1/photos" {
        let mut folders: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for file in &cfg.files {
            folders
                .entry(file.folder.clone())
                .or_default()
                .push(file.file.clone());
        }
        let dirs: Vec<String> = folders
            .into_iter()
            .map(|(name, files)| {
                let list = files
                    .into_iter()
                    .map(|file| format!("\"{file}\""))
                    .collect::<Vec<_>>()
                    .join(",");
                format!(r#"{{"name":"{name}","files":[{list}]}}"#)
            })
            .collect();
        let body = format!(r#"{{"dirs":[{}]}}"#, dirs.join(","));
        return json(200, &body);
    }
    if let Some(rest) = path.strip_prefix("/v1/photos/")
        && let Some((folder, file)) = rest.split_once('/')
    {
        if let Some(file) = file.strip_suffix("/info") {
            if let Some(found) = find_file(cfg, folder, file) {
                let body = format!(
                    r#"{{"dir":"{}","file":"{}","size":{},"cameraModel":"{}"}}"#,
                    found.folder,
                    found.file,
                    found.body.len(),
                    cfg.model
                );
                return json(200, &body);
            }
            return json(404, r#"{"errCode":404,"errMsg":"Not found"}"#);
        }
        if file.contains('/') {
            return json(404, r#"{"errCode":404,"errMsg":"Not found"}"#);
        }
        if let Some(found) = find_file(cfg, folder, file) {
            let payload = if query.get("size").map(String::as_str) == Some("thumb") {
                found.thumb.clone()
            } else {
                found.body.clone()
            };
            if method == "HEAD" {
                return (200, "application/octet-stream", payload);
            }
            return serve_payload(headers, cfg.support_range, payload);
        }
        return json(404, r#"{"errCode":404,"errMsg":"Not found"}"#);
    }
    json(404, r#"{"errCode":404,"errMsg":"Not found"}"#)
}

fn find_file<'a>(cfg: &'a MockConfig, folder: &str, file: &str) -> Option<&'a MockFile> {
    let folder = percent_decode(folder);
    let file = percent_decode(file);
    cfg.files
        .iter()
        .find(|item| item.folder == folder && item.file == file)
}

fn percent_decode(value: &str) -> String {
    let mut out = Vec::new();
    let bytes = value.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let Ok(byte) =
                u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16)
        {
            out.push(byte);
            i += 3;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn serve_payload(
    headers: &BTreeMap<String, String>,
    support_range: bool,
    payload: Vec<u8>,
) -> (u16, &'static str, Vec<u8>) {
    if support_range
        && let Some(range) = headers.get("range")
        && let Some(start) = parse_range(range, payload.len() as u64)
    {
        if start >= payload.len() as u64 {
            return (416, "application/octet-stream", Vec::new());
        }
        return (
            206,
            "application/octet-stream",
            payload[start as usize..].to_vec(),
        );
    }
    (200, "application/octet-stream", payload)
}

fn parse_range(header: &str, _len: u64) -> Option<u64> {
    let header = header.trim();
    let rest = header.strip_prefix("bytes=")?;
    let start = rest.split('-').next()?;
    start.parse().ok()
}

fn json(status: u16, body: &str) -> (u16, &'static str, Vec<u8>) {
    (status, "application/json", body.as_bytes().to_vec())
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        206 => "Partial Content",
        404 => "Not Found",
        405 => "Method Not Allowed",
        416 => "Range Not Satisfiable",
        _ => "OK",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::camera::CameraClient;
    use crate::importer::{FileImportStatus, Importer};
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn unique_dir() -> std::path::PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "ricoh-mac-import-{}-{}",
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
        ));
        fs::create_dir_all(&dir).expect("create test library directory");
        dir
    }

    fn client(server: &MockServer) -> CameraClient {
        CameraClient::new(server.base_url())
            .with_timeouts(Duration::from_secs(2), Duration::from_secs(5))
    }

    #[test]
    fn ping_props_and_list() {
        let server = MockServer::start(MockConfig::default()).unwrap();
        let client = client(&server);
        client.ping().unwrap();
        let props = client.props().unwrap();
        assert_eq!(props.model.as_deref(), Some("RICOH GR IIIx"));
        let photos = client.list_photos().unwrap();
        assert_eq!(photos.len(), 2);
        assert_eq!(photos[0].file, "R0000001.JPG");
        let probe = client.probe();
        assert!(probe.connected);
        assert!(probe.message.contains("RICOH GR IIIx"));
    }

    #[test]
    fn download_and_dedup() {
        let server = MockServer::start(MockConfig::default()).unwrap();
        let client = client(&server);
        let library = unique_dir();
        let photos = client.list_photos().unwrap();
        let importer = Importer::new(&library, &client);
        let first = importer.import_photos(&photos, |_| {});
        assert_eq!(first.imported(), 2);
        assert_eq!(first.errors(), 0);
        let jpg = library.join("R0000001.JPG");
        assert_eq!(fs::metadata(&jpg).unwrap().len(), 8 * 1024);
        let second = importer.import_photos(&photos, |_| {});
        assert_eq!(second.skipped(), 2);
        assert_eq!(second.imported(), 0);
        // Same name, different size already on disk is a conflict.
        fs::write(&jpg, b"different").unwrap();
        let only_jpg = vec![photos[0].clone()];
        let third = importer.import_photos(&only_jpg, |_| {});
        assert_eq!(third.conflicts(), 1);
        assert_eq!(third.results[0].status, FileImportStatus::Conflict);
        assert_eq!(fs::read(&jpg).unwrap(), b"different");
        let _ = fs::remove_dir_all(library);
    }

    #[test]
    fn partial_download_resumes_with_range() {
        let server = MockServer::start(MockConfig::default()).unwrap();
        let client = client(&server);
        let library = unique_dir();
        let photos = client.list_photos().unwrap();
        let jpg = &photos[0];
        let dest = library.join(&jpg.file);
        let partial = library.join(format!("{}.partial", jpg.file));
        fs::write(&partial, bytes_of("JPEG-R0000001", 100)).unwrap();
        let summary =
            Importer::new(&library, &client).import_photos(std::slice::from_ref(jpg), |_| {});
        assert_eq!(summary.results[0].status, FileImportStatus::Imported);
        assert_eq!(fs::metadata(&dest).unwrap().len(), 8 * 1024);
        assert!(!partial.exists());
        let _ = fs::remove_dir_all(library);
    }

    #[test]
    fn partial_download_starts_over_without_range() {
        let config = MockConfig {
            support_range: false,
            ..Default::default()
        };
        let server = MockServer::start(config).unwrap();
        let client = client(&server);
        let library = unique_dir();
        let photos = client.list_photos().unwrap();
        let jpg = &photos[0];
        let dest = library.join(&jpg.file);
        let partial = library.join(format!("{}.partial", jpg.file));
        fs::write(&partial, b"stale-partial").unwrap();
        let summary =
            Importer::new(&library, &client).import_photos(std::slice::from_ref(jpg), |_| {});
        assert_eq!(summary.results[0].status, FileImportStatus::Imported);
        assert_eq!(fs::metadata(&dest).unwrap().len(), 8 * 1024);
        assert!(!partial.exists());
        let _ = fs::remove_dir_all(library);
    }

    #[test]
    fn camera_offline() {
        let client = CameraClient::new("http://127.0.0.1:1")
            .with_timeouts(Duration::from_millis(200), Duration::from_millis(400));
        let probe = client.probe();
        assert!(!probe.connected);
        assert!(probe.message.contains("Not connected"));
        assert!(client.ping().is_err());
        assert!(client.list_photos().is_err());
    }
}
