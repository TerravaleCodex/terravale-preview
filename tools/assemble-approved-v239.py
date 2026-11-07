#!/usr/bin/env python3
"""Reassemble the user-approved, public-safe Terravale V2.39 offline site.

Never add the original restricted 36 article bodies to a public build.
The exact expected compressed and HTML checksums are pinned in manifest.json.
"""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parent.parent
parts_dir = root / ".preview-v239-approved"
manifest = json.loads((parts_dir / "manifest.json").read_text(encoding="utf-8"))
chunks = sorted(parts_dir.glob("part-*.b64"))
assert len(chunks) == manifest["parts"] == 19, "Missing or additional V2.39 package part"
assert [p.name for p in chunks] == [
    f"part-{i:03d}.b64" for i in range(manifest["parts"])
], "The package has unexpected names"
encoded = "".join(p.read_text(encoding="ascii").strip() for p in chunks)
assert len(encoded) == manifest["base64_chars"], "Compressed transfer length changed"
packed = base64.b64decode(encoded, validate=True)
assert len(packed) == manifest["gzip_bytes"], "Compressed size mismatch"
assert hashlib.sha256(packed).hexdigest() == manifest["compressed_sha256"], "Transfer checksum failure"
raw = gzip.decompress(packed)
assert len(raw) == manifest["html_bytes"], "HTML size mismatch"
assert hashlib.sha256(raw).hexdigest() == manifest["uncompressed_sha256"], "HTML checksum failure"
html = raw.decode("utf-8")

# This is the approved standalone V2 website, not the older V1 Next.js application.
for anchor in (
    'data-source="v2.css"',
    'data-source="v2.3-dashboard-polish.css"',
    'sr-workspace',
    'class="app"',
    'id="tv238-v14-content"',
    "window.TERRAVALE_V238={version:'2.39'",
):
    assert anchor in html, f"Approved V2.39 page element missing: {anchor}"
match = re.search(
    r'<script\s+type="application/json"\s+id="tv238-v14-content">([\s\S]*?)</script>',
    html,
)
assert match, "Missing embedded V14 lore content"
lore = json.loads(match.group(1))
assert len(lore["articles"]) == manifest["public_articles"] == 283
assert len(lore["heritageArticles"]) == manifest["restricted_placeholders"] == 36
assert len(lore["events"]) == manifest["calendar_events"] == 31
public_ids = {x["id"] for x in lore["articles"]}
private_ids = {x["id"] for x in lore["heritageArticles"]}
assert len(public_ids) == 283 and len(private_ids) == 36 and not (public_ids & private_ids)
for entry in lore["heritageArticles"]:
    assert entry["title"] == "Restricted ancestry article"
    assert entry["html"] == (
        "<p>Restricted ancestry knowledge. This public preview does not contain "
        "the article text. Authorised reading requires the future authenticated Codex.</p>"
    )
    assert entry["scope"] == "Restricted"
    assert not entry["lead"] and not entry["subtitle"] and not entry["related"] and not entry["source"]
for forbidden in ("emwlvbmnrrhxhrmlwkhs", "zlbubzdjecpxislpvyhx",
                  "sb_secret_", "The most ordinary-looking sheet of names"):
    assert forbidden not in html, "Private body or database reference in PUBLIC output"
assert "supabase.co" not in html.lower()
assert not re.search(r"<script[^>]+src=", html, re.I), "Standalone build needs a remote dependency"
assert manifest["server_side_auth"] is False and manifest["production_supabase_access"] is False

destination = root / "published" / "veiled-codex" / "index.html"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(raw)
print(f"PASS: authentic V2.39 standalone HTML ({len(raw)} bytes)")
print("PASS: 283 public articles, 36 content-free protected placeholders, 31 calendar events")
print("PASS: no backend/production access, no real protected lore bodies")
print(f"Output: {destination.relative_to(root)}")
