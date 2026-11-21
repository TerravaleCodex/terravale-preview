#!/usr/bin/env python3
"""Reproducible offline test: freeze real-layout HTML into independent V4 files.

The fixture is synthetic but follows the deployed V2.87 script/data shapes.
It verifies source ownership, redaction, original UI preservation, module
extraction, and protection against overwriting hand-edited V4 files.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FREEZE = ROOT / "tools/v4_freeze_independent.py"
sys.path.insert(0, str(ROOT / "tools"))
from v4_transform_snapshot import port
from v4_blank_content_patch import blank_native_rules

LORE = {
    "articles": [{"id": "secret-world-1", "title": "Frostvale Vault", "html": "Lore secret"}],
    "heritageArticles": [{"id": "restricted-1", "title": "Protected ancestry"}],
    "events": [{"name": "Frozen Moon Festival"}],
    "calendar": [{"name": "First Day of Frost"}],
}


def fixture() -> str:
    blocks = ['<!doctype html><html><head><title>Terravale Codex V2.87</title>',
              '<style id="v2.css">.app{color:white}</style>',
              '<style id="v2-extra.css">.sheet20{display:grid}</style>',
              '</head><body><main class="app" id="pageRoot"><section id="sheet20">Character</section>',
              '<section id="sr-workspace">Session Room</section></main>',
              '<script type="application/json" id="tv238-v14-content">' +
              json.dumps(LORE) + '</script>']
    for n in range(13):
        contents = 'window.v2Core' + str(n) + '=true;'
        if n == 0:
            contents += "const RULES={classes:[{name:'Winter Warden'}],ancestries:[{name:'Frostkin'}],skills:['Perception']};"
            contents += '/*' + 'x' * 650_000 + '*/'
        blocks.append('<script data-source="v2-native-' + str(n) + '.js">' + contents + '</script>')
    blocks.extend([
      '<script data-source="v254-dm-vault.js">window.realDmVault=true;</script>',
      '<script data-source="v270-divine-workspace.js">window.realDivine=true;</script>',
      '<script data-source="v287-adaptive-resources.js">window.realResources=true;</script>',
      '<script data-source="v247-demo-party-admin.js">const sample=["Aster"];</script>',
      '<script data-source="v248-curated-demo-sheets.js">const example=["Terravale Hero"];</script>',
      '<script data-source="v254-rules-registry.js">window.TerravaleRulesV4={classes:{},languages:[{name:"Dvergr"}],tools:[],currencies:[]};</script>',
      '<script type="module" data-source="v2-discord-auth.mjs">window.hostedAuth=true;</script>',
      '<script type="module" data-source="v2-ads-atelier.mjs">window.hostedAds=true;</script>',
      '<!-- finished live html padding; actual world data is only above -->',
      '<!-- ' + 'z' * 6_450_000 + ' -->',
      '</body></html>',
    ])
    return "\n".join(blocks)


class IndependentSourceTests(unittest.TestCase):
    def test_transform_removes_lore_not_ui(self):
        live = fixture()
        self.assertGreater(len(live.encode("utf-8")),7_000_000)
        converted = port(live)
        self.assertIn('id="sheet20"', converted)
        self.assertIn('id="sr-workspace"', converted)
        self.assertIn('data-source="v254-dm-vault.js"', converted)
        self.assertNotIn('Frostvale Vault', converted)
        self.assertNotIn('Frozen Moon Festival', converted)
        self.assertNotIn('Terravale Hero', converted)
        self.assertNotIn('Winter Warden', converted)
        self.assertIn("skills:['Perception']", converted)
        self.assertNotIn('data-source="v247-demo-party-admin.js"', converted)
        self.assertIn('data-source="v4-offline-database.js"', converted)

    def test_freeze_creates_real_editable_files_not_rebuild(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp)
            live=base/"input.html"
            live.write_text(fixture(),encoding="utf-8")
            output=base/"independent"
            cmd=[sys.executable,str(FREEZE),"--input",str(live),"--output",str(output)]
            made=subprocess.run(cmd,capture_output=True,text=True)
            self.assertEqual(made.returncode,0,msg=made.stdout + "\n" + made.stderr)
            manifest=json.loads((output/"V4_SOURCE_MANIFEST.json").read_text())
            self.assertTrue(manifest["independent_of_live_build"])
            self.assertEqual(manifest["captured_live_version"],"2.87")
            self.assertGreater(len(manifest["assets"]),10)
            self.assertTrue((output/"index.html").exists())
            self.assertTrue((base/"independent.zip").exists())
            scripts=list((output/"js").glob("*.js"))
            self.assertGreater(len(scripts),10)
            joined="\n".join(p.read_text(encoding="utf-8") for p in scripts)
            self.assertIn("window.realDmVault",joined)
            self.assertNotIn("Winter Warden",joined)
            self.assertNotIn("Frostvale Vault",joined)
            # No two builds should destroy hand-edited V4.
            important=output/"index.html"
            important.write_text(important.read_text()+"\n<!-- USER V4 CHANGES -->")
            sha=hashlib.sha256(important.read_bytes()).hexdigest()
            repeat=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(repeat.returncode,0)
            self.assertEqual(hashlib.sha256(important.read_bytes()).hexdigest(),sha)

    def test_blank_native_class_catalog_but_keep_technical_rules(self):
        source="<script>const RULES={classes:[{name:'Bloodforger'}],ancestries:[{name:'Oni'}],skills:['Perception']};</script>"
        blank, count, names = blank_native_rules(source)
        self.assertEqual(count,1)
        self.assertIn("classes:[]",blank)
        self.assertIn("ancestries:[]",blank)
        self.assertIn("skills:['Perception']",blank)
        self.assertCountEqual(names,["classes","ancestries"])


if __name__=="__main__":
    unittest.main()
