NSH ?= nsh
PYTHON ?= python3

# Development and release commands do not switch the system Wi-Fi.
# Override with RICOH_MAC_NO_WIFI_SWITCH= on the command line only when you
# intentionally need the real associate path.
export RICOH_MAC_NO_WIFI_SWITCH ?= 1

.PHONY: check test package clippy fmt fmt-fix dist

check:
	$(NSH) check

test:
	$(PYTHON) -B -m unittest discover -s scripts -p 'test_*.py'
	$(NSH) test

package:
	$(NSH) package --target macos

clippy:
	cargo clippy --all-targets -- -D warnings

fmt:
	cargo fmt --all -- --check

fmt-fix:
	cargo fmt --all

# Rebuild .nsh/out/ricoh-mac.app and write dist/ricoh-mac-<tag>-macos-arm64.zip
# plus a SHA-256 sidecar. Defaults the tag to v plus the version in nsh.json
# and Cargo.toml. Does not create a GitHub Release.
dist:
	TAG="$(TAG)" PYTHON="$(PYTHON)" ./scripts/release-dist.sh
