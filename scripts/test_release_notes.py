"""Black-box release-note tests. All archives and version notes are temporary fixtures."""

import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class ReleaseNotesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "scripts").mkdir()
        self.notes = self.root / "docs" / "releases"
        self.notes.mkdir(parents=True)
        for name in ("release-notes.py", "release-notes-preamble.md"):
            shutil.copyfile(ROOT / "scripts" / name, self.root / "scripts" / name)
        self.tag = "v1.2.3"
        self.write_notes()
        self.archive = self.root / f"ricoh-mac-{self.tag}-macos-arm64.zip"
        self.archive.write_bytes(b"temporary archive fixture")
        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.checksum = self.archive.with_suffix(".zip.sha256")
        self.checksum.write_text(f"{self.digest}  {self.archive.name}\n")

    def write_notes(self):
        (self.notes / f"{self.tag}.zh-CN.md").write_text(f"# {self.tag}\n\n- 中文更新。\n", encoding="utf-8")
        (self.notes / f"{self.tag}.en.md").write_text(f"# {self.tag}\n\n- English change.\n", encoding="utf-8")

    def run_notes(self):
        return subprocess.run(
            [sys.executable, str(self.root / "scripts" / "release-notes.py"),
             "--tag", self.tag, "--archive", str(self.archive),
             "--checksum", str(self.checksum), "--repository", "example/camera"],
            capture_output=True, text=True, env={**os.environ, "RICOH_MAC_NO_WIFI_SWITCH": "1"},
        )

    def assert_failure(self, message):
        result = self.run_notes()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn(message, result.stderr)

    def test_product_body_order_assets_and_one_checksum(self):
        result = self.run_notes()
        self.assertEqual(result.returncode, 0, result.stderr)
        body = result.stdout
        headings = [line for line in body.splitlines() if line.startswith("#")]
        self.assertEqual(headings, ["## 本版本更新", "## What's new", "## 安装", "## Install", "## 校验（可选）"])
        self.assertLess(body.index("中文更新"), body.index("English change"))
        self.assertIn(f"https://github.com/example/camera/releases/download/{self.tag}/{self.archive.name}", body)
        self.assertEqual(body.count(self.digest), 1)
        self.assertNotIn(f"# {self.tag}", body)
        self.assertNotIn("__ZIP_", body)
        self.assertNotIn("__SHA256__", body)
        self.assertNotIn("Full Changelog", body)
        self.assertIn("ad hoc", body)
        self.assertIn("not notarized", body)

    def test_missing_either_language_fails_without_partial_body(self):
        for language in ("zh-CN", "en"):
            with self.subTest(language=language):
                self.write_notes()
                (self.notes / f"{self.tag}.{language}.md").unlink()
                self.assert_failure(f"Missing release notes: {self.tag}.{language}.md")

    def test_empty_or_heading_only_notes_fail(self):
        for text in ("  ", f"# {self.tag}\n\n"):
            with self.subTest(text=text):
                (self.notes / f"{self.tag}.en.md").write_text(text)
                self.assert_failure("Empty release notes")

    def test_wrong_version_heading_fails(self):
        (self.notes / f"{self.tag}.en.md").write_text("# v0.0.1\n\n- Wrong version.\n")
        self.assert_failure("Release notes heading must be '# v1.2.3'")

    def test_notes_without_a_version_heading_are_kept(self):
        (self.notes / f"{self.tag}.en.md").write_text("- English change.\n")
        result = self.run_notes()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("## What's new\n\n- English change.", result.stdout)

    def test_crlf_headings_do_not_duplicate(self):
        (self.notes / f"{self.tag}.en.md").write_bytes(f"# {self.tag}\r\n\r\n- English change.\r\n".encode())
        result = self.run_notes()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(f"# {self.tag}", result.stdout)

    def test_prerelease_uses_its_own_notes_and_asset(self):
        self.tag = "v1.2.4-rc.1"
        self.write_notes()
        self.archive = self.root / f"ricoh-mac-{self.tag}-macos-arm64.zip"
        self.archive.write_bytes(b"temporary archive fixture")
        self.checksum.write_text(f"{self.digest}  {self.archive.name}\n")
        result = self.run_notes()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"/releases/download/{self.tag}/{self.archive.name}", result.stdout)

    def test_wrong_asset_filename_fails(self):
        self.archive = self.root / "wrong.zip"
        self.assert_failure("Expected archive named")

    def test_bad_checksum_or_other_asset_fails(self):
        for text in ("not a hash", f"{self.digest}  other.zip\n"):
            with self.subTest(text=text):
                self.checksum.write_text(text)
                self.assert_failure("Invalid checksum file")

    def test_checksum_must_match_archive_bytes(self):
        self.archive.write_bytes(b"changed archive")
        self.assert_failure("SHA-256 mismatch")

    def test_tag_cannot_traverse_outside_notes_directory(self):
        self.tag = "../../v1.2.3"
        self.assert_failure("Invalid release tag")

    def test_current_repository_notes_render_without_modification(self):
        for chinese in (ROOT / "docs" / "releases").glob("*.zh-CN.md"):
            tag = chinese.name.removesuffix(".zh-CN.md")
            with self.subTest(tag=tag):
                self.tag = tag
                for language in ("zh-CN", "en"):
                    name = f"{tag}.{language}.md"
                    shutil.copyfile(ROOT / "docs" / "releases" / name, self.notes / name)
                self.archive = self.root / f"ricoh-mac-{tag}-macos-arm64.zip"
                self.archive.write_bytes(b"temporary archive fixture")
                self.checksum.write_text(f"{self.digest}  {self.archive.name}\n")
                result = self.run_notes()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.count("## 本版本更新"), 1)
                self.assertEqual(result.stdout.count("## What's new"), 1)


if __name__ == "__main__":
    unittest.main()
