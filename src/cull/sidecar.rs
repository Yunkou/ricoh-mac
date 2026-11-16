//! XMP sidecar paths and read/write, without changing the original photograph.

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use xml::attribute::OwnedAttribute;
use xml::name::OwnedName;
use xml::namespace::Namespace;
use xml::reader::{EventReader, ParserConfig, XmlEvent};
use xml::writer::{EmitterConfig, EventWriter, XmlEvent as WriteEvent};

use super::{Flag, Marks};
use crate::error::AppError;

pub const XMP_NS: &str = "http://ns.adobe.com/xap/1.0/";
pub const RDF_NS: &str = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
pub const X_NS: &str = "adobe:ns:meta/";
pub const FLAG_NS: &str = "http://ns.yunkou.ricoh-mac/1.0/";
const FLAG_PREFIX: &str = "ricohMac";
const XMP_PREFIX: &str = "xmp";
const MAX_SIDECAR_BYTES: u64 = 1_048_576;
const PACKET_BEGIN: &str = r#"<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>"#;
const PACKET_END: &str = r#"<?xpacket end="w"?>"#;

static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

pub fn canonical_sidecar_path(photo: &Path) -> Result<PathBuf, AppError> {
    let parent = photo
        .parent()
        .ok_or_else(|| AppError::msg("找不到这张照片。"))?;
    let name = file_name_of(photo)?;
    Ok(parent.join(format!("{name}.xmp")))
}

fn stem_sidecar_path(photo: &Path) -> Result<PathBuf, AppError> {
    let parent = photo
        .parent()
        .ok_or_else(|| AppError::msg("找不到这张照片。"))?;
    let name = file_name_of(photo)?;
    let stem = Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::msg("找不到这张照片。"))?;
    if stem.is_empty() || stem.contains('/') || stem.contains('\\') || stem.contains("..") {
        return Err(AppError::msg("找不到这张照片。"));
    }
    Ok(parent.join(format!("{stem}.xmp")))
}

fn file_name_of(photo: &Path) -> Result<&str, AppError> {
    let name = photo
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::msg("找不到这张照片。"))?;
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name == "."
        || name == ".."
        || name.contains("\0")
    {
        return Err(AppError::msg("找不到这张照片。"));
    }
    Ok(name)
}

fn stem_of(file: &str) -> Option<&str> {
    Path::new(file).file_stem()?.to_str()
}

fn stem_is_shared(file: &str, siblings: &[String]) -> bool {
    let Some(stem) = stem_of(file) else {
        return false;
    };
    siblings
        .iter()
        .any(|other| other != file && stem_of(other) == Some(stem))
}

/// The sidecar chosen by the current read policy, if one exists.
/// This does not create or rewrite a sidecar.
pub fn sidecar_for_copy(photo: &Path, siblings: &[String]) -> Result<Option<PathBuf>, AppError> {
    sidecar_for_read(photo, siblings)
}

fn sidecar_for_read(photo: &Path, siblings: &[String]) -> Result<Option<PathBuf>, AppError> {
    let canonical = canonical_sidecar_path(photo)?;
    if canonical.is_file() {
        return Ok(Some(canonical));
    }
    let file = file_name_of(photo)?;
    if stem_is_shared(file, siblings) {
        return Ok(None);
    }
    let fallback = stem_sidecar_path(photo)?;
    if fallback.is_file() {
        Ok(Some(fallback))
    } else {
        Ok(None)
    }
}

/// Read marks for `photo`. `None` means no usable sidecar was found.
pub fn read_marks(photo: &Path, siblings: &[String]) -> Result<Option<Marks>, AppError> {
    let Some(path) = sidecar_for_read(photo, siblings)? else {
        return Ok(None);
    };
    let text = read_sidecar_text(&path)?;
    Ok(Some(parse_marks(&text)?))
}

/// Write marks to the canonical `{file.ext}.xmp` sidecar.
///
/// Existing unknown XMP fields and namespaces are kept. A corrupt sidecar is
/// left unchanged and the error is returned. The original photograph is not
/// written. This function never writes a shared `{stem}.xmp` file.
pub fn write_marks(photo: &Path, marks: Marks) -> Result<(), AppError> {
    if !photo.is_file() {
        return Err(AppError::msg("找不到这张照片。"));
    }
    let dest = canonical_sidecar_path(photo)?;
    let xml = if dest.is_file() {
        let existing = read_sidecar_text(&dest)?;
        update_xmp(&existing, marks)
            .map_err(|err| AppError::msg(format!("这张照片的标记文件已损坏，未改写：{err}")))?
    } else {
        new_xmp(marks)
    };
    atomic_write(&dest, xml.as_bytes())?;
    Ok(())
}

fn read_sidecar_text(path: &Path) -> Result<String, AppError> {
    let meta = fs::metadata(path).map_err(|err| AppError::io("无法读取标记文件", err))?;
    if !meta.is_file() {
        return Err(AppError::msg("无法读取标记文件。"));
    }
    if meta.len() > MAX_SIDECAR_BYTES {
        return Err(AppError::msg("标记文件过大，未读取。"));
    }
    let bytes = fs::read(path).map_err(|err| AppError::io("无法读取标记文件", err))?;
    let text = decode_xml(&bytes)?;
    reject_unsafe_xml(&text)?;
    Ok(text)
}

fn decode_xml(bytes: &[u8]) -> Result<String, AppError> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        return decode_utf16(bytes, u16::from_le_bytes);
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        return decode_utf16(bytes, u16::from_be_bytes);
    }
    let utf8 = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        &bytes[3..]
    } else {
        bytes
    };
    String::from_utf8(utf8.to_vec()).map_err(|_| AppError::msg("标记文件的编码无法识别。"))
}

fn decode_utf16(bytes: &[u8], decode: fn([u8; 2]) -> u16) -> Result<String, AppError> {
    if bytes.len() < 2 || !bytes.len().is_multiple_of(2) {
        return Err(AppError::msg("标记文件的编码无法识别。"));
    }
    let units: Vec<u16> = bytes[2..]
        .as_chunks::<2>()
        .0
        .iter()
        .map(|chunk| decode(*chunk))
        .collect();
    String::from_utf16(&units).map_err(|_| AppError::msg("标记文件的编码无法识别。"))
}

fn reject_unsafe_xml(text: &str) -> Result<(), AppError> {
    let mut lower = String::with_capacity(text.len());
    for ch in text.chars() {
        lower.push(ch.to_ascii_lowercase());
    }
    if lower.contains("<!doctype") || lower.contains("<!entity") {
        return Err(AppError::msg("标记文件包含不安全的 XML 声明，未读取。"));
    }
    Ok(())
}

fn parser_config() -> ParserConfig {
    ParserConfig::new()
        .ignore_comments(false)
        .ignore_root_level_whitespace(false)
        .trim_whitespace(false)
        .allow_multiple_root_elements(true)
        .max_entity_expansion_length(32)
        .max_entity_expansion_depth(1)
        .max_attribute_length(4096)
        .max_data_length(64 * 1024)
}

fn parse_marks(text: &str) -> Result<Marks, AppError> {
    let reader = EventReader::new_with_config(Cursor::new(text.as_bytes()), parser_config());
    let mut rating = 0u8;
    let mut flag = Flag::None;
    let mut found_rating = false;
    let mut in_rating = false;
    let mut in_flag = false;
    for event in reader {
        let event = event.map_err(|err| AppError::msg(format!("无法解析标记文件：{err}")))?;
        match event {
            XmlEvent::Doctype { .. } => {
                return Err(AppError::msg("标记文件包含不安全的 XML 声明，未读取。"));
            }
            XmlEvent::StartElement {
                name, attributes, ..
            } => {
                if is_name(&name, "Rating", XMP_NS) {
                    in_rating = true;
                }
                if is_name(&name, "Flag", FLAG_NS) {
                    in_flag = true;
                }
                for attr in attributes {
                    if is_name(&attr.name, "Rating", XMP_NS)
                        || (attr.name.local_name == "Rating"
                            && matches!(attr.name.prefix.as_deref(), Some("xmp" | "xap")))
                    {
                        rating = parse_rating(&attr.value)?;
                        found_rating = true;
                    }
                    if is_name(&attr.name, "Flag", FLAG_NS)
                        || (attr.name.local_name == "Flag"
                            && attr.name.prefix.as_deref() == Some(FLAG_PREFIX))
                    {
                        flag = parse_flag_value(&attr.value)?;
                    }
                }
            }
            XmlEvent::Characters(text) | XmlEvent::CData(text) => {
                if in_rating {
                    rating = parse_rating(&text)?;
                    found_rating = true;
                }
                if in_flag {
                    flag = parse_flag_value(&text)?;
                }
            }
            XmlEvent::EndElement { name } => {
                if is_name(&name, "Rating", XMP_NS) {
                    in_rating = false;
                }
                if is_name(&name, "Flag", FLAG_NS) {
                    in_flag = false;
                }
            }
            _ => {}
        }
    }
    if !found_rating {
        rating = 0;
    }
    Marks::new(rating, flag)
}

fn parse_rating(value: &str) -> Result<u8, AppError> {
    let trimmed = value.trim();
    // Adobe uses -1 for rejected. Stars stay independent of our flag, so
    // treat -1 as unrated rather than as a star value.
    if trimmed == "-1" {
        return Ok(0);
    }
    let parsed = trimmed
        .parse::<f64>()
        .map_err(|_| AppError::msg("标记文件中的星级无法识别。"))?;
    if !parsed.is_finite() || parsed < 0.0 || parsed > 5.0 {
        return Err(AppError::msg("标记文件中的星级无法识别。"));
    }
    Ok(parsed.round() as u8)
}

fn parse_flag_value(value: &str) -> Result<Flag, AppError> {
    match value.trim() {
        "" | "none" => Ok(Flag::None),
        "picked" => Ok(Flag::Picked),
        "rejected" => Ok(Flag::Rejected),
        other => Err(AppError::msg(format!("标记文件中的标记无法识别：{other}"))),
    }
}

fn is_name(name: &OwnedName, local: &str, ns: &str) -> bool {
    name.local_name == local && name.namespace.as_deref() == Some(ns)
}

fn is_description(name: &OwnedName) -> bool {
    name.local_name == "Description" && name.namespace.as_deref() == Some(RDF_NS)
}

fn new_xmp(marks: Marks) -> String {
    let rating = marks.rating.value();
    let flag_attr = match marks.flag {
        Flag::None => String::new(),
        Flag::Picked | Flag::Rejected => {
            format!(r#" ricohMac:Flag="{}""#, marks.flag.as_str())
        }
    };
    format!(
        "{PACKET_BEGIN}\n<x:xmpmeta xmlns:x=\"{X_NS}\">\n <rdf:RDF xmlns:rdf=\"{RDF_NS}\">\n  <rdf:Description rdf:about=\"\" xmlns:xmp=\"{XMP_NS}\" xmlns:ricohMac=\"{FLAG_NS}\" xmp:Rating=\"{rating}\"{flag_attr}/>\n </rdf:RDF>\n</x:xmpmeta>\n{PACKET_END}\n"
    )
}

fn update_xmp(existing: &str, marks: Marks) -> Result<String, AppError> {
    reject_unsafe_xml(existing)?;
    let reader = EventReader::new_with_config(Cursor::new(existing.as_bytes()), parser_config());
    let mut output = Vec::new();
    let mut writer = EventWriter::new_with_config(
        &mut output,
        EmitterConfig::new()
            .perform_indent(false)
            .write_document_declaration(false)
            .keep_element_names_stack(true),
    );
    let mut saw_root = false;
    let mut in_rating = false;
    let mut in_flag = false;
    let mut wrote_rating_attr = false;
    let mut wrote_flag_attr = false;
    let mut replaced_rating_text = false;
    let mut replaced_flag_text = false;
    let mut pending_chars = String::new();
    let mut first_description_open = true;
    let mut skip_chars = false;

    for event in reader {
        let event = event.map_err(|err| AppError::msg(format!("无法解析标记文件：{err}")))?;
        match event {
            XmlEvent::StartDocument { .. } => {}
            XmlEvent::EndDocument => {}
            XmlEvent::Doctype { .. } => {
                return Err(AppError::msg("标记文件包含不安全的 XML 声明，未读取。"));
            }
            XmlEvent::StartElement {
                name,
                attributes,
                namespace,
            } => {
                saw_root = true;
                flush_chars(&mut writer, &mut pending_chars, skip_chars)?;
                let is_rating = is_name(&name, "Rating", XMP_NS);
                let is_flag = is_name(&name, "Flag", FLAG_NS);
                if is_rating {
                    in_rating = true;
                    skip_chars = true;
                }
                if is_flag {
                    in_flag = true;
                    skip_chars = true;
                }
                let mut attrs = attributes;
                let mut ns = namespace;
                if first_description_open && is_description(&name) {
                    first_description_open = false;
                    ns.put(XMP_PREFIX, XMP_NS);
                    ns.put(FLAG_PREFIX, FLAG_NS);
                    upsert_attr(
                        &mut attrs,
                        "Rating",
                        XMP_NS,
                        XMP_PREFIX,
                        &marks.rating.value().to_string(),
                    );
                    wrote_rating_attr = true;
                    match marks.flag {
                        Flag::None => {
                            attrs.retain(|attr| !is_flag_attr(attr));
                            wrote_flag_attr = true;
                        }
                        Flag::Picked | Flag::Rejected => {
                            upsert_attr(
                                &mut attrs,
                                "Flag",
                                FLAG_NS,
                                FLAG_PREFIX,
                                marks.flag.as_str(),
                            );
                            wrote_flag_attr = true;
                        }
                    }
                }
                write_start(&mut writer, &name, &attrs, &ns)?;
            }
            XmlEvent::EndElement { name } => {
                if in_rating && is_name(&name, "Rating", XMP_NS) {
                    pending_chars.clear();
                    write_event(
                        &mut writer,
                        WriteEvent::Characters(&marks.rating.value().to_string()),
                    )?;
                    replaced_rating_text = true;
                    in_rating = false;
                    skip_chars = false;
                } else if in_flag && is_name(&name, "Flag", FLAG_NS) {
                    pending_chars.clear();
                    let text = if marks.flag == Flag::None {
                        ""
                    } else {
                        marks.flag.as_str()
                    };
                    write_event(&mut writer, WriteEvent::Characters(text))?;
                    replaced_flag_text = true;
                    in_flag = false;
                    skip_chars = false;
                } else {
                    flush_chars(&mut writer, &mut pending_chars, skip_chars)?;
                }
                write_event(
                    &mut writer,
                    WriteEvent::EndElement {
                        name: Some(name.borrow()),
                    },
                )?;
            }
            XmlEvent::Characters(text) | XmlEvent::Whitespace(text) | XmlEvent::CData(text) => {
                if !skip_chars {
                    pending_chars.push_str(&text);
                }
            }
            XmlEvent::Comment(text) => {
                flush_chars(&mut writer, &mut pending_chars, skip_chars)?;
                write_event(&mut writer, WriteEvent::Comment(&text))?;
            }
            XmlEvent::ProcessingInstruction { name, data } => {
                flush_chars(&mut writer, &mut pending_chars, skip_chars)?;
                write_event(
                    &mut writer,
                    WriteEvent::ProcessingInstruction {
                        name: &name,
                        data: data.as_deref(),
                    },
                )?;
            }
        }
    }
    flush_chars(&mut writer, &mut pending_chars, skip_chars)?;
    if !saw_root {
        return Err(AppError::msg("无法解析标记文件。"));
    }
    let _ = (
        wrote_rating_attr,
        wrote_flag_attr,
        replaced_rating_text,
        replaced_flag_text,
    );
    let xml = String::from_utf8(output).map_err(|_| AppError::msg("无法写入标记文件。"))?;
    Ok(ensure_packet(&xml))
}

fn is_flag_attr(attr: &OwnedAttribute) -> bool {
    is_name(&attr.name, "Flag", FLAG_NS)
        || (attr.name.local_name == "Flag" && attr.name.prefix.as_deref() == Some(FLAG_PREFIX))
}

fn upsert_attr(attrs: &mut Vec<OwnedAttribute>, local: &str, ns: &str, prefix: &str, value: &str) {
    if let Some(existing) = attrs.iter_mut().find(|attr| {
        is_name(&attr.name, local, ns)
            || (attr.name.local_name == local && attr.name.prefix.as_deref() == Some(prefix))
    }) {
        existing.value = value.to_string();
        return;
    }
    attrs.push(OwnedAttribute {
        name: OwnedName {
            local_name: local.to_string(),
            namespace: Some(ns.to_string()),
            prefix: Some(prefix.to_string()),
        },
        value: value.to_string(),
    });
}

fn write_start(
    writer: &mut EventWriter<&mut Vec<u8>>,
    name: &OwnedName,
    attrs: &[OwnedAttribute],
    ns: &Namespace,
) -> Result<(), AppError> {
    let borrowed: Vec<xml::attribute::Attribute<'_>> = attrs.iter().map(|a| a.borrow()).collect();
    write_event(
        writer,
        WriteEvent::StartElement {
            name: name.borrow(),
            attributes: borrowed.into(),
            namespace: ns.borrow(),
        },
    )
}

fn flush_chars(
    writer: &mut EventWriter<&mut Vec<u8>>,
    pending: &mut String,
    skip: bool,
) -> Result<(), AppError> {
    if skip {
        pending.clear();
        return Ok(());
    }
    if pending.is_empty() {
        return Ok(());
    }
    let text = pending.clone();
    pending.clear();
    write_event(writer, WriteEvent::Characters(&text))
}

fn write_event(
    writer: &mut EventWriter<&mut Vec<u8>>,
    event: WriteEvent<'_>,
) -> Result<(), AppError> {
    writer
        .write(event)
        .map_err(|err| AppError::msg(format!("无法写入标记文件：{err}")))
}

fn ensure_packet(xml: &str) -> String {
    let trimmed = xml.trim();
    if trimmed.contains("<?xpacket") {
        let mut out = trimmed.to_string();
        if !out.ends_with('\n') {
            out.push('\n');
        }
        return out;
    }
    format!("{PACKET_BEGIN}\n{trimmed}\n{PACKET_END}\n")
}

fn atomic_write(dest: &Path, bytes: &[u8]) -> Result<(), AppError> {
    let parent = dest
        .parent()
        .ok_or_else(|| AppError::msg("无法写入标记文件。"))?;
    let file_name = dest
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::msg("无法写入标记文件。"))?;
    if dest.is_dir() {
        return Err(AppError::msg("无法写入标记文件。"));
    }
    let tmp = parent.join(format!(
        ".{file_name}.{}.{}.partial",
        std::process::id(),
        TMP_SEQ.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&tmp, bytes).map_err(|err| {
        let _ = fs::remove_file(&tmp);
        AppError::io("无法写入标记文件", err)
    })?;
    match fs::rename(&tmp, dest) {
        Ok(()) => Ok(()),
        Err(err) => {
            let _ = fs::remove_file(&tmp);
            Err(AppError::io("无法写入标记文件", err))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{canonical_sidecar_path, new_xmp, read_marks, write_marks};
    use crate::cull::{Flag, Marks};
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_dir(label: &str) -> PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "ricoh-mac-sidecar-{}-{}-{}-{}",
            label,
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_photo(dir: &std::path::Path, name: &str, bytes: &[u8]) -> PathBuf {
        let path = dir.join(name);
        fs::write(&path, bytes).unwrap();
        path
    }

    #[test]
    fn writes_and_reads_canonical_sidecars_without_changing_the_photo() {
        let dir = unique_dir("basic");
        let photo = write_photo(&dir, "R0000001.JPG", b"original-jpeg");
        let siblings = vec!["R0000001.JPG".into()];
        assert!(read_marks(&photo, &siblings).unwrap().is_none());
        write_marks(&photo, Marks::new(3, Flag::Picked).unwrap()).unwrap();
        assert_eq!(
            read_marks(&photo, &siblings).unwrap(),
            Some(Marks::new(3, Flag::Picked).unwrap())
        );
        write_marks(&photo, Marks::new(0, Flag::None).unwrap()).unwrap();
        assert_eq!(
            read_marks(&photo, &siblings).unwrap(),
            Some(Marks::default())
        );
        assert_eq!(fs::read(&photo).unwrap(), b"original-jpeg");
        assert!(
            canonical_sidecar_path(&photo)
                .unwrap()
                .ends_with("R0000001.JPG.xmp")
        );
    }

    #[test]
    fn same_stem_jpeg_and_dng_use_separate_sidecars() {
        let dir = unique_dir("pair");
        let jpeg = write_photo(&dir, "R0000001.JPG", b"jpeg");
        let dng = write_photo(&dir, "R0000001.DNG", b"dng");
        let siblings = vec!["R0000001.JPG".into(), "R0000001.DNG".into()];
        fs::write(
            dir.join("R0000001.xmp"),
            new_xmp(Marks::new(5, Flag::Picked).unwrap()),
        )
        .unwrap();
        assert!(read_marks(&jpeg, &siblings).unwrap().is_none());
        assert!(read_marks(&dng, &siblings).unwrap().is_none());
        write_marks(&jpeg, Marks::new(2, Flag::Picked).unwrap()).unwrap();
        write_marks(&dng, Marks::new(4, Flag::Rejected).unwrap()).unwrap();
        assert_eq!(
            read_marks(&jpeg, &siblings).unwrap(),
            Some(Marks::new(2, Flag::Picked).unwrap())
        );
        assert_eq!(
            read_marks(&dng, &siblings).unwrap(),
            Some(Marks::new(4, Flag::Rejected).unwrap())
        );
        let shared = fs::read_to_string(dir.join("R0000001.xmp")).unwrap();
        assert!(shared.contains("Rating=\"5\""));
        assert_eq!(fs::read(&jpeg).unwrap(), b"jpeg");
        assert_eq!(fs::read(&dng).unwrap(), b"dng");
    }

    #[test]
    fn an_unambiguous_stem_sidecar_is_read_but_writes_go_to_the_canonical_file() {
        let dir = unique_dir("stem");
        let dng = write_photo(&dir, "R0000002.DNG", b"dng");
        let siblings = vec!["R0000002.DNG".into()];
        fs::write(
            dir.join("R0000002.xmp"),
            new_xmp(Marks::new(1, Flag::None).unwrap()),
        )
        .unwrap();
        assert_eq!(
            read_marks(&dng, &siblings).unwrap(),
            Some(Marks::new(1, Flag::None).unwrap())
        );
        write_marks(&dng, Marks::new(5, Flag::Picked).unwrap()).unwrap();
        assert_eq!(
            read_marks(&dng, &siblings).unwrap(),
            Some(Marks::new(5, Flag::Picked).unwrap())
        );
        let stem = fs::read_to_string(dir.join("R0000002.xmp")).unwrap();
        assert!(stem.contains("Rating=\"1\""));
        let canonical = fs::read_to_string(dir.join("R0000002.DNG.xmp")).unwrap();
        assert!(canonical.contains("Rating=\"5\""));
        assert_eq!(fs::read(&dng).unwrap(), b"dng");
    }

    #[test]
    fn preserves_unknown_xmp_fields_when_updating() {
        let dir = unique_dir("preserve");
        let photo = write_photo(&dir, "R0000003.JPG", b"jpeg");
        let existing = r#"<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmp:Rating="2" xmp:CreatorTool="OtherApp">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Keep me</rdf:li></rdf:Alt></dc:title>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
"#;
        fs::write(dir.join("R0000003.JPG.xmp"), existing).unwrap();
        write_marks(&photo, Marks::new(4, Flag::Rejected).unwrap()).unwrap();
        let updated = fs::read_to_string(dir.join("R0000003.JPG.xmp")).unwrap();
        assert!(updated.contains("Keep me"), "{updated}");
        assert!(updated.contains("CreatorTool"), "{updated}");
        assert!(updated.contains("OtherApp"), "{updated}");
        assert!(
            updated.contains("http://purl.org/dc/elements/1.1/"),
            "{updated}"
        );
        assert!(updated.contains("Rating"), "{updated}");
        let siblings = vec!["R0000003.JPG".into()];
        assert_eq!(
            read_marks(&photo, &siblings).unwrap(),
            Some(Marks::new(4, Flag::Rejected).unwrap())
        );
        assert_eq!(fs::read(&photo).unwrap(), b"jpeg");
    }

    #[test]
    fn a_corrupt_sidecar_is_left_unchanged() {
        let dir = unique_dir("corrupt");
        let photo = write_photo(&dir, "R0000004.JPG", b"jpeg");
        let sidecar = dir.join("R0000004.JPG.xmp");
        fs::write(&sidecar, b"<not xml & totally broken").unwrap();
        let err = write_marks(&photo, Marks::new(1, Flag::None).unwrap())
            .unwrap_err()
            .to_string();
        assert!(err.contains("损坏") || err.contains("无法"), "{err}");
        assert_eq!(fs::read(&sidecar).unwrap(), b"<not xml & totally broken");
        assert_eq!(fs::read(&photo).unwrap(), b"jpeg");
    }

    #[test]
    fn rejects_xxe_payloads_and_leaves_the_sidecar() {
        let dir = unique_dir("xxe");
        let photo = write_photo(&dir, "R0000005.JPG", b"jpeg");
        let sidecar = dir.join("R0000005.JPG.xmp");
        let xxe = r#"<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<x:xmpmeta xmlns:x="adobe:ns:meta/">&xxe;</x:xmpmeta>
"#;
        fs::write(&sidecar, xxe).unwrap();
        let err = write_marks(&photo, Marks::new(1, Flag::None).unwrap())
            .unwrap_err()
            .to_string();
        assert!(
            err.contains("不安全") || err.contains("损坏") || err.contains("无法"),
            "{err}"
        );
        assert_eq!(fs::read(&sidecar).unwrap(), xxe.as_bytes());
        assert_eq!(fs::read(&photo).unwrap(), b"jpeg");
        assert!(read_marks(&photo, &["R0000005.JPG".into()]).is_err());
    }

    #[test]
    fn rejects_path_elements_in_the_file_name() {
        let dir = unique_dir("escape");
        let photo = dir.join("..");
        let err = canonical_sidecar_path(&photo).unwrap_err().to_string();
        assert!(err.contains("找不到"), "{err}");
    }
}
