NSH ?= nsh

.PHONY: check test package clippy fmt fmt-fix

check:
	$(NSH) check

test:
	$(NSH) test

package:
	$(NSH) package --target macos

clippy:
	cargo clippy --all-targets -- -D warnings

fmt:
	cargo fmt --all -- --check

fmt-fix:
	cargo fmt --all
