#!/usr/bin/env python3
"""Private, deliberately manual Supabase Storage -> Neon staging migration.

No secrets, object keys, URLs, bytes or bearer tokens are logged.
Default: inventory-only (dry run). --execute also requires an explicit
CONFIRM_NEON_STORAGE_WRITE=yes and staging-only Neon S3 credentials.

Source: Supabase Storage REST with a server-side service-role key.
Destination: Neon's S3-compatible Object Storage, preserving exact object keys.
A source/destination SHA-256 round-trip is performed on every copied file.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

BUCKETS = {
    "terravale-character-portraits": {"public": False, "max_bytes": 4_194_304, "expected": 10},
    "terravale-profile-avatars": {"public": True, "max_bytes": 2_097_152, "expected": 3},
}
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_OBJECTS = 200
LIST_LIMIT = 100


def need_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"Required secure environment variable missing: {name}")
    return value


def approved_endpoint(value: str, suffix: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or not (
        parsed.hostname == suffix.lstrip(".") or parsed.hostname.endswith(suffix)
    ):
        raise ValueError("Storage endpoint must use HTTPS on its expected provider domain")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Storage endpoint must not contain embedded credentials")
    return value.rstrip("/")


def safe_key(key: str) -> str:
    if not isinstance(key, str) or not key or len(key) > 1024:
        raise ValueError("Invalid object key")
    if key.startswith("/") or "\\" in key or any(ord(ch) < 32 for ch in key):
        raise ValueError("Unsafe object key")
    if any(component in ("", ".", "..") for component in key.split("/")):
        raise ValueError("Unsafe path segments")
    return key


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def fetch_json(url: str, key: str, body: dict) -> list:
    req = Request(
        url,
        data=json.dumps(body, separators=(",", ":")).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urlopen(req, timeout=45) as response:
        parsed = json.loads(response.read())
    if not isinstance(parsed, list):
        raise ValueError("Unexpected source storage listing format")
    return parsed


def list_objects(root: str, service_key: str, bucket: str) -> list[dict]:
    """Walk Supabase's folder-based listing, including paginated folders."""
    objects: list[dict] = []
    pending = [""]
    visited = set()
    names_seen = set()
    while pending:
        prefix = pending.pop()
        if prefix in visited:
            continue
        visited.add(prefix)
        offset = 0
        while True:
            url = root + "/storage/v1/object/list/" + quote(bucket, safe="")
            entries = fetch_json(url, service_key, {
                "prefix": prefix,
                "limit": LIST_LIMIT,
                "offset": offset,
                "sortBy": {"column": "name", "order": "asc"},
            })
            for entry in entries:
                if not isinstance(entry, dict) or not isinstance(entry.get("name"), str):
                    raise ValueError("Unexpected source object listing entry")
                name = entry["name"]
                if entry.get("id") is None:
                    # Supabase represents folders as entries without object IDs.
                    if name in ("", ".", "..") or "/" in name:
                        raise ValueError("Invalid source folder")
                    pending.append(prefix + name + "/")
                    continue
                key = safe_key(prefix + name)
                if key in names_seen:
                    raise ValueError("Duplicate object key found")
                names_seen.add(key)
                metadata = entry.get("metadata") or {}
                if not isinstance(metadata, dict):
                    raise ValueError("Invalid object metadata")
                mime = str(metadata.get("mimetype") or metadata.get("mimeType") or "").lower()
                size = int(metadata.get("size") or 0)
                if mime not in ALLOWED_MIME:
                    raise ValueError("Unexpected source object MIME type")
                if size < 1 or size > BUCKETS[bucket]["max_bytes"]:
                    raise ValueError("Source image exceeds expected bucket limits")
                objects.append({"key": key, "mime": mime, "size": size})
                if len(objects) > MAX_OBJECTS:
                    raise ValueError("Unusually large source inventory; manual review required")
            if len(entries) < LIST_LIMIT:
                break
            offset += LIST_LIMIT
    return sorted(objects, key=lambda o: o["key"])


def download_source(root: str, service_key: str, bucket: str, path: str) -> bytes:
    url = root + "/storage/v1/object/authenticated/" + quote(bucket, safe="") + "/" + quote(path, safe="/")
    req = Request(url, method="GET", headers={
        "apikey": service_key,
        "Authorization": "Bearer " + service_key,
    })
    with urlopen(req, timeout=90) as response:
        return response.read(BUCKETS[bucket]["max_bytes"] + 1)


def destination_bytes(s3, bucket: str, key: str):
    from botocore.exceptions import ClientError
    try:
        result = s3.get_object(Bucket=bucket, Key=key)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code in {"NoSuchKey", "NotFound", "404"}:
            return None
        raise
    body = result["Body"]
    try:
        content = body.read()
    finally:
        body.close()
    return content, str(result.get("ContentType", "")).split(";")[0].strip().lower()


def transfer_one(s3, source_url: str, service_key: str, bucket: str, info: dict) -> str:
    source = download_source(source_url, service_key, bucket, info["key"])
    if len(source) != info["size"]:
        raise ValueError("Source file changed size during transfer; retry after source stabilizes")
    content_hash = sha256(source)
    found = destination_bytes(s3, bucket, info["key"])
    if found is not None:
        existing, mime = found
        if sha256(existing) != content_hash or mime != info["mime"]:
            raise ValueError("Destination key already exists with different bytes or MIME; refusing overwrite")
        return "already_verified"
    s3.put_object(
        Bucket=bucket,
        Key=info["key"],
        Body=source,
        ContentType=info["mime"],
        CacheControl="public, max-age=300" if BUCKETS[bucket]["public"] else "private, no-store",
    )
    checked = destination_bytes(s3, bucket, info["key"])
    if checked is None or sha256(checked[0]) != content_hash or checked[1] != info["mime"]:
        raise ValueError("Destination round-trip SHA-256/MIME verification failed")
    return "copied_and_verified"


def main() -> int:
    args = argparse.ArgumentParser(
        description="Private Supabase -> Neon image migration; dry-run unless --execute",
    )
    args.add_argument("--execute", action="store_true", help="Write and round-trip verify Neon staging objects")
    options = args.parse_args()
    root = approved_endpoint(need_env("TERRAVALE_SUPABASE_URL"), ".supabase.co")
    service_key = need_env("TERRAVALE_SUPABASE_SERVICE_ROLE_KEY")
    if options.execute and os.environ.get("CONFIRM_NEON_STORAGE_WRITE") != "yes":
        raise ValueError("--execute needs CONFIRM_NEON_STORAGE_WRITE=yes")
    inventory = {bucket: list_objects(root, service_key, bucket) for bucket in BUCKETS}
    totals = {name: len(items) for name, items in inventory.items()}
    bytes_total = sum(item["size"] for items in inventory.values() for item in items)
    print("Source storage inventory (object names not shown):", totals, "total_bytes:", bytes_total)
    if any(len(inventory[name]) != spec["expected"] for name, spec in BUCKETS.items()):
        print("NOTICE: source counts changed since initial snapshot. Review before final cutover.")
    if not options.execute:
        print("DRY RUN: no Neon storage writes; set action 'execute' to proceed after reviewing credentials.")
        return 0

    import boto3
    from botocore.config import Config
    endpoint = approved_endpoint(need_env("TERRAVALE_NEON_S3_ENDPOINT"), ".neon.tech")
    access_id = need_env("TERRAVALE_NEON_S3_ACCESS_KEY_ID")
    secret = need_env("TERRAVALE_NEON_S3_SECRET_ACCESS_KEY")
    region = need_env("TERRAVALE_NEON_S3_REGION")
    s3 = boto3.client(
        "s3", endpoint_url=endpoint, region_name=region,
        aws_access_key_id=access_id, aws_secret_access_key=secret,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                      retries={"mode": "standard", "max_attempts": 3}),
    )
    copied = skipped = 0
    for bucket, entries in inventory.items():
        for entry in entries:
            outcome = transfer_one(s3, root, service_key, bucket, entry)
            copied += outcome == "copied_and_verified"
            skipped += outcome == "already_verified"
    print("Complete: SHA-256 verified copied:", copied, "already-matching:", skipped,
          "total:", copied + skipped, "bytes:", bytes_total)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (HTTPError, URLError) as exc:
        print("Storage migration stopped due to provider HTTP/network error (details redacted).", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        # Never print a signed URL, storage object key, bearer token, or private data.
        print("Storage migration stopped safely:", type(exc).__name__, file=sys.stderr)
        sys.exit(1)
