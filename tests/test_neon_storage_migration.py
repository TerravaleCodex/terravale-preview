"""Offline, secret-free tests for the manual Neon staging storage migration."""
import importlib.util
import io
import pathlib
import sys
import unittest
from unittest import mock

PATH = pathlib.Path(__file__).resolve().parents[1] / "tools" / "neon_storage_migration.py"
SPEC = importlib.util.spec_from_file_location("neon_storage_migration", PATH)
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)


class StorageSafetyTests(unittest.TestCase):
    def test_safe_keys(self):
        self.assertEqual(migration.safe_key("folder/portrait with spaces.png"),
                         "folder/portrait with spaces.png")
        for value in ("../secret.png", "x/../secret.png", "/absolute.png",
                      "folder//img.png", "img\\escape.png", "x/\x00file", "", "x/./y"):
            with self.subTest(key=repr(value)):
                with self.assertRaises(ValueError):
                    migration.safe_key(value)

    def test_reject_redirect_or_off_domain(self):
        self.assertEqual(
            migration.approved_endpoint("https://project.supabase.co", ".supabase.co"),
            "https://project.supabase.co",
        )
        for url in ("http://project.supabase.co", "https://supabase.co.attacker.test",
                    "https://x.supabase.co/path?token=secret", "https://x.neon.tech"):
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    migration.approved_endpoint(url, ".supabase.co")

    def test_recursive_inventory_without_keys_in_output(self):
        def fake_list(url, service_key, body):
            prefix = body["prefix"]
            if prefix == "":
                return [
                    {"name": "a.png", "id": "row-1",
                     "metadata": {"mimetype": "image/png", "size": 4}},
                    {"name": "nested", "id": None, "metadata": None},
                ]
            if prefix == "nested/":
                return [{"name": "other.jpg", "id": "row-2",
                         "metadata": {"mimetype": "image/jpeg", "size": 7}}]
            raise AssertionError("Unexpected folder")
        with mock.patch.object(migration, "fetch_json", side_effect=fake_list):
            results = migration.list_objects("https://a.supabase.co", "fake-key",
                                             "terravale-character-portraits")
        self.assertEqual(len(results), 2)
        self.assertEqual([x["size"] for x in results], [4, 7])

    def test_reject_invalid_mime_and_size(self):
        for info in (
            {"name": "unsafe.svg", "id": "a",
             "metadata": {"mimetype": "image/svg+xml", "size": 100}},
            {"name": "giant.png", "id": "b",
             "metadata": {"mimetype": "image/png", "size": 50_000_000}},
        ):
            with mock.patch.object(migration, "fetch_json", return_value=[info]):
                with self.assertRaises(ValueError):
                    migration.list_objects("https://a.supabase.co", "key",
                                           "terravale-profile-avatars")

    def test_new_file_put_and_round_trip_hash(self):
        class FakeS3:
            def __init__(self):
                self.writes = []
            def put_object(self, **kwargs):
                self.writes.append(kwargs)
        dest = FakeS3()
        with mock.patch.object(migration, "download_source", return_value=b"PNG!"), \
             mock.patch.object(migration, "destination_bytes",
                 side_effect=[None, (b"PNG!", "image/png")]):
            result = migration.transfer_one(dest, "https://a.supabase.co", "not-real",
                "terravale-character-portraits",
                {"key": "p.png", "mime": "image/png", "size": 4})
        self.assertEqual(result, "copied_and_verified")
        self.assertEqual(len(dest.writes), 1)
        self.assertEqual(dest.writes[0]["Body"], b"PNG!")
        self.assertEqual(dest.writes[0]["CacheControl"], "private, no-store")

    def test_already_matching_is_idempotent(self):
        with mock.patch.object(migration, "download_source", return_value=b"image"), \
             mock.patch.object(migration, "destination_bytes",
                 return_value=(b"image", "image/jpeg")):
            result = migration.transfer_one(object(), "https://a.supabase.co", "secret",
                "terravale-profile-avatars",
                {"key": "a.jpg", "mime": "image/jpeg", "size": 5})
        self.assertEqual(result, "already_verified")

    def test_conflicting_existing_file_refuses_overwrite(self):
        with mock.patch.object(migration, "download_source", return_value=b"image"), \
             mock.patch.object(migration, "destination_bytes",
                 return_value=(b"changed", "image/jpeg")):
            with self.assertRaisesRegex(ValueError, "refusing overwrite"):
                migration.transfer_one(object(), "https://a.supabase.co", "secret",
                    "terravale-profile-avatars",
                    {"key": "a.jpg", "mime": "image/jpeg", "size": 5})

    def test_source_size_drift_refuses_upload(self):
        with mock.patch.object(migration, "download_source", return_value=b"x"):
            with self.assertRaisesRegex(ValueError, "changed size"):
                migration.transfer_one(object(), "https://a.supabase.co", "secret",
                    "terravale-profile-avatars",
                    {"key": "a.jpg", "mime": "image/jpeg", "size": 7})

    def test_dry_run_does_not_touch_neon(self):
        with mock.patch.dict(migration.os.environ, {
            "TERRAVALE_SUPABASE_URL": "https://a.supabase.co",
            "TERRAVALE_SUPABASE_SERVICE_ROLE_KEY": "non-real-secret",
        }, clear=True), mock.patch.object(migration, "list_objects",
             return_value=[]), mock.patch.object(sys, "argv", ["script"]):
            with mock.patch("sys.stdout", new_callable=io.StringIO) as buffer:
                self.assertEqual(migration.main(), 0)
            self.assertIn("DRY RUN", buffer.getvalue())

    def test_write_needs_separate_confirmation(self):
        with mock.patch.dict(migration.os.environ, {
            "TERRAVALE_SUPABASE_URL": "https://a.supabase.co",
            "TERRAVALE_SUPABASE_SERVICE_ROLE_KEY": "non-real-secret",
        }, clear=True), mock.patch.object(sys, "argv", ["script", "--execute"]):
            with self.assertRaisesRegex(ValueError, "CONFIRM_NEON_STORAGE_WRITE"):
                migration.main()


if __name__ == "__main__":
    unittest.main()
