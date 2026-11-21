#!/usr/bin/env python3
"""Parity guard: V4 first pass must use the *actual* original V2 HTML.

No reconstructed home, character sheet, DM Chronicle or Session Room is
permitted in this step. The only allowed changes are removal of 2
cloud-specific modules, theme controls and expanded-sidebar styling.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"tools"/"export-v4-offline-first-pass.py"
spec=importlib.util.spec_from_file_location("v4_live_first_pass",SCRIPT)
module=importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)

class LiveLayoutParity(unittest.TestCase):
    def test_only_network_modules_and_injections_change(self):
        source='''<!doctype html><html><head><title>V2.87</title></head><body>
          <main id="real-live-v2" data-screen="character-sheet">
          <section id="real-session-room">Initiative Chat Dice</section>
          <section id="actual-dm-chronicle">DM Chronicle</section>
          </main>
          <script data-source="v287-adaptive-resources.js">window.REAL_V287=true;</script>
          <script type="application/json" id="tv238-v14-content">{"articles":[{"id":"1","title":"Hidden Kingdom","html":"Secrets"}],"heritageArticles":[],"events":[{"name":"Festival of Ice"}]}</script>
          <script data-source="v247-demo-party-admin.js">const curatedParty=["Demo Player"];</script>
          <script data-source="v248-curated-demo-sheets.js">const curatedSheet=["Demo Hero"];</script>
          <script data-source="v254-rules-registry.js">window.TerravaleRulesV4={"tools":[{"name":"Runecarver"}],"languages":[{"name":"Dvergr"}],"currencies":[],"classes":{}};</script>
          <script>const RULES={classes:[{name:"Daemon Knight"}],ancestries:[{name:"Shadowfolk"}],skills:["Perception"]};</script>
          <script type="module" data-source="v2-discord-auth.mjs">fetch("https://example.org/");</script>
          <script type="module" data-source="v2-ads-atelier.mjs">fetch("https://example.org/");</script>
          </body></html>'''
        result=module.port(source)
        self.assertIn('<main id="real-live-v2"',result)
        self.assertIn('<section id="real-session-room">Initiative Chat Dice</section>',result)
        self.assertIn('<section id="actual-dm-chronicle">DM Chronicle</section>',result)
        self.assertIn('window.REAL_V287=true',result)
        self.assertNotIn('data-source="v2-discord-auth.mjs"',result)
        self.assertNotIn('data-source="v2-ads-atelier.mjs"',result)
        self.assertIn('--bg:#0c0912',result)
        self.assertNotIn('Hidden Kingdom',result)
        self.assertNotIn('Festival of Ice',result)
        self.assertNotIn('Runecarver',result)
        self.assertNotIn('Daemon Knight',result)
        self.assertNotIn('Demo Hero',result)
        self.assertIn('skills:["Perception"]',result)
        self.assertIn('classes:[]',result)
        self.assertIn('--bg:#06050a',result)
        self.assertIn('sidebar-is-collapsed',result)
        self.assertIn('v4-offline-controls',result)

    def test_missing_actual_v2_auth_integration_is_not_silently_ignored(self):
        with self.assertRaisesRegex(RuntimeError,'Expected one real V2 module'):
            module.port('<html><head></head><body></body></html>')

    def test_preserved_live_features_when_build_available(self):
        reference=ROOT/"dist"/"v4-live-baseline"/"index.html"
        offline=ROOT/"dist"/"V4_Live_Layout_Offline_First_Pass.html"
        if not reference.exists() or not offline.exists():
            self.skipTest("Official production assembly is not yet present")
        before=reference.read_text(encoding="utf-8")
        after=offline.read_text(encoding="utf-8")
        self.assertGreater(len(before),7_000_000)
        self.assertEqual(after,module.port(before))
        for feature in ('v254-dm-vault.js','v270-divine-workspace.js',
                        'v287-adaptive-resources.js'):
            self.assertEqual(after.count('data-source="'+feature+'"'),1)
        self.assertGreater(len(after),6_500_000)

if __name__=="__main__":
    unittest.main()
