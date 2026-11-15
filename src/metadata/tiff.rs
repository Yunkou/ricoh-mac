//! Read-only helpers for TIFF-like IFDs used by DNG previews and MakerNotes.

const MAX_IFDS: usize = 32;
const MAX_ENTRIES: usize = 256;

#[derive(Debug, Clone, Copy)]
pub struct Endian(bool);

impl Endian {
    pub const LITTLE: Self = Self(true);
    pub const BIG: Self = Self(false);

    pub fn little(self) -> bool {
        self.0
    }

    pub fn from_header(data: &[u8]) -> Option<Self> {
        if data.starts_with(b"II") {
            Some(Self::LITTLE)
        } else if data.starts_with(b"MM") {
            Some(Self::BIG)
        } else {
            None
        }
    }
}

pub fn u16_at(data: &[u8], offset: usize, endian: Endian) -> Option<u16> {
    let bytes = data.get(offset..offset.checked_add(2)?)?;
    let arr = [bytes[0], bytes[1]];
    Some(if endian.little() {
        u16::from_le_bytes(arr)
    } else {
        u16::from_be_bytes(arr)
    })
}

pub fn u32_at(data: &[u8], offset: usize, endian: Endian) -> Option<u32> {
    let bytes = data.get(offset..offset.checked_add(4)?)?;
    let arr = [bytes[0], bytes[1], bytes[2], bytes[3]];
    Some(if endian.little() {
        u32::from_le_bytes(arr)
    } else {
        u32::from_be_bytes(arr)
    })
}

/// A single 12-byte IFD entry.
#[derive(Debug, Clone, Copy)]
pub struct IfdEntry {
    pub tag: u16,
    pub typ: u16,
    pub count: u32,
    pub value_or_offset: u32,
}

impl IfdEntry {
    pub fn parse(data: &[u8], offset: usize, endian: Endian) -> Option<Self> {
        Some(Self {
            tag: u16_at(data, offset, endian)?,
            typ: u16_at(data, offset + 2, endian)?,
            count: u32_at(data, offset + 4, endian)?,
            value_or_offset: u32_at(data, offset + 8, endian)?,
        })
    }

    pub fn type_size(self) -> Option<u32> {
        Some(match self.typ {
            1 | 2 | 6 | 7 => 1,
            3 | 8 => 2,
            4 | 9 | 11 => 4,
            5 | 10 | 12 => 8,
            _ => return None,
        })
    }

    pub fn byte_len(self) -> Option<u32> {
        self.type_size()?.checked_mul(self.count)
    }

    pub fn first_u32_from(self, data: &[u8], entry_offset: usize, endian: Endian) -> Option<u32> {
        let len = self.byte_len()? as usize;
        if len == 0 {
            return None;
        }
        let bytes = if len <= 4 {
            data.get(entry_offset + 8..entry_offset + 12)?
        } else {
            let start = self.value_or_offset as usize;
            data.get(start..start.checked_add(len)?)?
        };
        match self.typ {
            1 | 7 => Some(u32::from(*bytes.first()?)),
            3 => Some(u32::from(u16_at(bytes, 0, endian)?)),
            4 => u32_at(bytes, 0, endian),
            _ => None,
        }
    }

    pub fn u32_list(self, data: &[u8], entry_offset: usize, endian: Endian) -> Option<Vec<u32>> {
        let len = self.byte_len()? as usize;
        if self.count == 0 || self.count > 64 {
            return None;
        }
        let bytes = if len <= 4 {
            data.get(entry_offset + 8..entry_offset + 12)?
        } else {
            let start = self.value_or_offset as usize;
            data.get(start..start.checked_add(len)?)?
        };
        let mut values = Vec::with_capacity(self.count as usize);
        for i in 0..self.count as usize {
            let value = match self.typ {
                3 => u32::from(u16_at(bytes, i * 2, endian)?),
                4 => u32_at(bytes, i * 4, endian)?,
                1 | 7 => u32::from(*bytes.get(i)?),
                _ => return None,
            };
            values.push(value);
        }
        Some(values)
    }
}

pub fn read_ifd(
    data: &[u8],
    offset: usize,
    endian: Endian,
) -> Option<(Vec<(IfdEntry, usize)>, usize)> {
    let count = u16_at(data, offset, endian)? as usize;
    if count == 0 || count > MAX_ENTRIES {
        return None;
    }
    let mut entries = Vec::with_capacity(count);
    let mut cursor = offset.checked_add(2)?;
    for _ in 0..count {
        let entry = IfdEntry::parse(data, cursor, endian)?;
        entries.push((entry, cursor));
        cursor = cursor.checked_add(12)?;
    }
    let next = u32_at(data, cursor, endian)? as usize;
    Some((entries, next))
}

/// Walks IFD0, subsequent IFDs, and SubIFDs (tag 0x014A). Does not follow Exif/GPS pointers.
pub fn walk_ifds(
    data: &[u8],
    start: usize,
    endian: Endian,
) -> Vec<(usize, Vec<(IfdEntry, usize)>)> {
    let mut visited = Vec::new();
    let mut queue = vec![start];
    while let Some(offset) = queue.pop() {
        if offset == 0 || visited.iter().any(|(seen, _)| *seen == offset) {
            continue;
        }
        if visited.len() >= MAX_IFDS {
            break;
        }
        let Some((entries, next)) = read_ifd(data, offset, endian) else {
            continue;
        };
        for (entry, entry_offset) in &entries {
            if entry.tag == 0x014A
                && let Some(offsets) = entry.u32_list(data, *entry_offset, endian)
            {
                for child in offsets {
                    if child > 0 {
                        queue.push(child as usize);
                    }
                }
            }
        }
        if next > 0 {
            queue.push(next);
        }
        visited.push((offset, entries));
    }
    visited
}

pub fn tiff_header(data: &[u8]) -> Option<(Endian, usize)> {
    let endian = Endian::from_header(data)?;
    let magic = u16_at(data, 2, endian)?;
    if magic != 42 {
        return None;
    }
    let ifd0 = u32_at(data, 4, endian)? as usize;
    if ifd0 < 8 {
        return None;
    }
    Some((endian, ifd0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_little_endian_ifd_short() {
        // II, magic 42, IFD at 8, one SHORT tag 0x0100 = 640
        let mut data = vec![b'I', b'I', 42, 0, 8, 0, 0, 0];
        // count = 1
        data.extend_from_slice(&[1, 0]);
        // tag 0x0100, type 3, count 1, value 640
        data.extend_from_slice(&[0x00, 0x01, 0x03, 0x00, 1, 0, 0, 0, 0x80, 0x02, 0, 0]);
        // next IFD
        data.extend_from_slice(&[0, 0, 0, 0]);
        let (endian, ifd0) = tiff_header(&data).unwrap();
        let (entries, next) = read_ifd(&data, ifd0, endian).unwrap();
        assert_eq!(next, 0);
        assert_eq!(entries[0].0.tag, 0x0100);
        assert_eq!(
            entries[0].0.first_u32_from(&data, entries[0].1, endian),
            Some(640)
        );
    }
}
