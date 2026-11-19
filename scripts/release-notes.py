#!/usr/bin/env python3
"""Render bilingual product notes for a tag and its verified archive."""

import argparse
import hashlib
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def changes(root: Path, tag: str, language: str) -> str:
    path = root / "docs" / "releases" / f"{tag}.{language}.md"
    try:
        text = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        raise ValueError(f"Missing release notes: {path.name}") from None
    lines = text.splitlines()
    if lines and lines[0].startswith("# "):
        if lines[0] != f"# {tag}":
            raise ValueError(f"Release notes heading must be '# {tag}': {path.name}")
        text = "\n".join(lines[1:]).strip()
    if not text:
        raise ValueError(f"Empty release notes: {path.name}")
    return text


def render(root: Path, tag: str, archive: Path, checksum: Path, repository: str) -> str:
    # The release version gate checks SemVer; also keep filenames inside docs/releases.
    if not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?", tag):
        raise ValueError(f"Invalid release tag: {tag}")
    name = f"ricoh-mac-{tag}-macos-arm64.zip"
    if archive.name != name:
        raise ValueError(f"Expected archive named {name}")
    chinese = changes(root, tag, "zh-CN")
    english = changes(root, tag, "en")
    fields = checksum.read_text(encoding="utf-8").split()
    if len(fields) != 2 or fields[1] != name or not re.fullmatch(r"[0-9a-fA-F]{64}", fields[0]):
        raise ValueError(f"Invalid checksum file for {name}")
    digest = hashlib.sha256()
    with archive.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != fields[0].lower():
        raise ValueError(f"SHA-256 mismatch for {name}")
    template = (root / "scripts" / "release-notes-preamble.md").read_text(encoding="utf-8")
    installation = (
        template.replace("__ZIP_NAME__", name)
        .replace("__ZIP_URL__", f"https://github.com/{repository}/releases/download/{tag}/{name}")
        .replace("__SHA256__", digest.hexdigest())
        .strip()
    )
    return f"## 本版本更新\n\n{chinese}\n\n## What's new\n\n{english}\n\n{installation}\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--checksum", required=True, type=Path)
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", "Yunkou/ricoh-mac"))
    args = parser.parse_args()
    try:
        body = render(ROOT, args.tag, args.archive, args.checksum, args.repository)
    except (ValueError, OSError) as error:
        parser.exit(1, f"Release notes: {error}\n")
    print(body, end="")


if __name__ == "__main__":
    main()
