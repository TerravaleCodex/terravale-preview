#!/usr/bin/env python3
"""Make an unmodified, byte-for-byte snapshot of the actual live V2 site.

This script runs the *same* source assembly used by the production GitHub Pages
workflow, then copies the resulting live client and static assets. It deliberately
does not recreate HTML from a design reference, add an alternate shell, or rewrite
data/auth: those changes belong to subsequent V4 migration work.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "published" / "veiled-codex"
OUT = ROOT / "dist" / "v4-live-baseline"
ARCHIVE = ROOT / "dist" / "V4_Live_Exact_Source_Baseline.zip"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    for script in ("tools/assemble-approved-v239.py",
                   "tools/overlay-v239-with-discord.py"):
        print(f"Running original live build: {script}", flush=True)
        subprocess.run([sys.executable, str(ROOT / script)], cwd=ROOT, check=True)

    entry = SOURCE / "index.html"
    if not entry.is_file():
        raise RuntimeError("The live build has not produced its actual index.html")
    original = entry.read_bytes()
    for marker in (
        b'Terravale Codex V2.87',
        b'data-source="v2.css"',
        b'data-source="v2-discord-auth.mjs"',
        b'data-source="v254-dm-vault.js"',
        b'data-source="v270-divine-workspace.js"',
        b'data-source="v287-adaptive-resources.js"',
    ):
        if marker not in original:
            raise RuntimeError(f"Missing live V2.87 feature marker: {marker!r}")
    if len(original) <= 7_000_000:
        raise RuntimeError("Unexpectedly small site; do not export a mockup")

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for path in SOURCE.rglob("*"):
        if not path.is_file():
            continue
        target = OUT / path.relative_to(SOURCE)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        if sha256(path) != sha256(target):
            raise RuntimeError(f"Copied file differs: {path}")

    files = {str(p.relative_to(OUT)).replace("\\", "/"):
             {"bytes": p.stat().st_size, "sha256": sha256(p)}
             for p in sorted(OUT.rglob("*")) if p.is_file()}
    manifest = {
        "purpose": "unaltered live V2.87 source snapshot, not yet an offline application",
        "source": "original public-safe Terravale V2 site via production build scripts",
        "html_sha256": sha256(entry),
        "original_bytes": len(original),
        "file_count": len(files),
        "files": files,
        "limitations": [
            "The copy retains production login, storage and network integration.",
            "It has not yet been adapted for genuinely offline account/campaign storage.",
            "No new V4 sidebar, theme changes or campaign rules have been applied.",
            "Protected ancestry lore remains placeholders, as in the public site.",
        ],
    }
    manifest_path = OUT.parent / "V4_LIVE_SOURCE_MANIFEST.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED,
                         compresslevel=7) as archive:
        for p in OUT.rglob("*"):
            if p.is_file():
                archive.write(p, arcname="veiled-codex/" + p.relative_to(OUT).as_posix())
        archive.write(manifest_path, arcname=manifest_path.name)
    print(f"Exact live HTML: {len(original):,} bytes, SHA256 {manifest['html_sha256']}")
    print(f"Copied {len(files)} original files unchanged.")
    print(f"Snapshot: {ARCHIVE}")
    print("NOTE: This is authentic live V2; it is NOT YET adapted to work offline.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
