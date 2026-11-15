#!/bin/bash
# Package the macOS app and write a versioned zip plus SHA-256 checksum under dist/.
# This script does not create a GitHub Release.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
NSH="${NSH:-nsh}"
DIST_DIR="${DIST_DIR:-dist}"
APP="${APP:-.nsh/out/ricoh-mac.app}"

version="$("$PYTHON" scripts/release-version.py --print-version)"
tag="${TAG:-v${version}}"
"$PYTHON" scripts/release-version.py --tag "$tag"

arch="$(uname -m)"
if [[ "$arch" != "arm64" ]]; then
  echo "This distribution target is macos-arm64, but the machine architecture is ${arch}." >&2
  exit 1
fi

"$NSH" package --target macos

if [[ ! -d "$APP" ]]; then
  echo "Expected a packaged app at ${APP}." >&2
  exit 1
fi

zip_name="ricoh-mac-${tag}-macos-arm64.zip"
mkdir -p "$DIST_DIR"
rm -f "${DIST_DIR}/${zip_name}" "${DIST_DIR}/${zip_name}.sha256"
ditto -c -k --keepParent "$APP" "${DIST_DIR}/${zip_name}"
(
  cd "$DIST_DIR"
  shasum -a 256 "$zip_name" > "${zip_name}.sha256"
)

echo "Wrote ${DIST_DIR}/${zip_name}"
echo "Wrote ${DIST_DIR}/${zip_name}.sha256"
