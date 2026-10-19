"""Tests for scripts/publish-legal.py, run in CI next to the publication check.

    python3 -m unittest scripts/test_publish_legal.py

Each test builds a throwaway copy of the legal Markdown tree and migrations
folder, so the real repository files are never touched.
"""

import contextlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "publish-legal.py"


def load_script():
    spec = importlib.util.spec_from_file_location("publish_legal", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PublishLegalTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.pub = load_script()
        self.pub.ROOT = root
        self.pub.LOCALES = root / "locales"
        self.pub.MIGRATIONS = root / "migrations"
        self.pub.MANIFEST = root / "legal" / "published.json"
        self.pub.MIGRATIONS.mkdir()
        (self.pub.MIGRATIONS / "52_existing.sql").write_text("-- existing\n")
        for lang in self.pub.LANGS:
            folder = self.pub.LOCALES / lang / "legal"
            folder.mkdir(parents=True)
            for slug, file_name in self.pub.POLICIES:
                (folder / file_name).write_text(f"# {slug} ({lang})\n\nText of {slug}.\n")

    def tearDown(self):
        self.tmp.cleanup()

    def run_quietly(self, fn):
        with contextlib.redirect_stdout(io.StringIO()):
            return fn()

    def migrations(self):
        return sorted(p.name for p in self.pub.MIGRATIONS.glob("*_publish_legal_policies.sql"))

    def test_check_fails_until_the_documents_are_published(self):
        self.assertEqual(self.run_quietly(self.pub.check), 1)

        self.run_quietly(self.pub.publish)

        self.assertEqual(self.run_quietly(self.pub.check), 0)
        self.assertEqual(self.migrations(), ["53_publish_legal_policies.sql"])

    def test_publishing_twice_without_changes_writes_nothing(self):
        self.run_quietly(self.pub.publish)

        self.run_quietly(self.pub.publish)

        self.assertEqual(self.migrations(), ["53_publish_legal_policies.sql"])

    def test_an_edit_is_caught_and_published_as_a_new_version_of_that_document_only(self):
        self.run_quietly(self.pub.publish)
        terms = self.pub.LOCALES / "fr" / "legal" / "terms.md"
        terms.write_text(terms.read_text() + "\nNouvelle clause.\n")

        self.assertEqual(self.run_quietly(self.pub.check), 1)
        self.run_quietly(self.pub.publish)

        self.assertEqual(
            self.migrations(),
            ["53_publish_legal_policies.sql", "54_publish_legal_policies.sql"],
        )
        sql = (self.pub.MIGRATIONS / "54_publish_legal_policies.sql").read_text()
        self.assertIn("'terms'", sql)
        self.assertNotIn("'privacy'", sql)
        self.assertEqual(self.run_quietly(self.pub.check), 0)

    def test_quotes_in_the_text_are_escaped_for_sql(self):
        privacy = self.pub.LOCALES / "en" / "legal" / "privacy.md"
        privacy.write_text("# Privacy\n\nCoopData's users.\n")

        self.run_quietly(self.pub.publish)

        sql = (self.pub.MIGRATIONS / "53_publish_legal_policies.sql").read_text()
        self.assertIn("CoopData''s users.", sql)

    def test_a_document_without_a_title_line_is_rejected(self):
        (self.pub.LOCALES / "ss" / "legal" / "cookies.md").write_text("No title here.\n")

        with self.assertRaises(self.pub.PublishError):
            self.run_quietly(self.pub.publish)


if __name__ == "__main__":
    unittest.main()
