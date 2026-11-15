#!/usr/bin/env python3
"""Check that release versions in nsh.json, Cargo.toml, and an optional git tag agree."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_RE = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
    r"(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$"
)


def read_nsh_version() -> str:
    data = json.loads((ROOT / "nsh.json").read_text(encoding="utf-8"))
    version = data.get("version")
    if not isinstance(version, str) or not version:
        raise SystemExit("nsh.json is missing a string 'version' field.")
    return version


def read_cargo_version() -> str:
    text = (ROOT / "Cargo.toml").read_text(encoding="utf-8")
    in_package = False
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("[") and line.endswith("]"):
            in_package = line == "[package]"
            continue
        if in_package and line.startswith("version"):
            _, _, rest = line.partition("=")
            value = rest.strip()
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"Could not parse package.version in Cargo.toml: {value!r}.") from exc
            if not isinstance(parsed, str) or not parsed:
                raise SystemExit("Cargo.toml package.version must be a string.")
            return parsed
    raise SystemExit("Cargo.toml is missing package.version.")


def parse_tag(tag: str) -> str:
    if not tag.startswith("v") or tag == "v":
        raise SystemExit(
            f"Unsupported tag {tag!r}. Use a tag of the form v<version>, "
            "where <version> is the exact value of nsh.json and Cargo.toml "
            "(for example v0.1.0 or v0.1.0-rc.1)."
        )
    return tag[1:]


def is_prerelease(version: str) -> bool:
    match = VERSION_RE.match(version)
    return bool(match and match.group(4))


def require_semver(label: str, version: str) -> None:
    if not VERSION_RE.match(version):
        raise SystemExit(
            f"{label} value {version!r} is not a supported semantic version "
            "(for example 0.1.0 or 0.1.0-rc.1)."
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", help="Git tag to check, including the leading v.")
    parser.add_argument("--print-version", action="store_true", help="Print the shared file version.")
    parser.add_argument(
        "--print-channel",
        action="store_true",
        help="Print 'prerelease' or 'stable' for the checked version.",
    )
    args = parser.parse_args(argv)

    nsh_version = read_nsh_version()
    cargo_version = read_cargo_version()
    require_semver("nsh.json version", nsh_version)
    require_semver("Cargo.toml package.version", cargo_version)
    if nsh_version != cargo_version:
        raise SystemExit(
            f"nsh.json version is {nsh_version}, but Cargo.toml package.version is {cargo_version}. "
            "These two values must be identical before a release."
        )

    version = nsh_version
    if args.tag:
        tag_version = parse_tag(args.tag)
        require_semver("git tag", tag_version)
        if tag_version != version:
            raise SystemExit(
                f"Release version mismatch: the git tag is {args.tag}, but nsh.json and "
                f"Cargo.toml are both {version}. Set both files to {tag_version} "
                "(including any prerelease suffix) and commit that change before tagging "
                f"{args.tag}."
            )

    if args.print_version:
        print(version)
    if args.print_channel:
        print("prerelease" if is_prerelease(version) else "stable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
