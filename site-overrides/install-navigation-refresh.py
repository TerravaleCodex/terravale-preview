#!/usr/bin/env python3
"""Install the live navigation update without rebuilding or editing the checked preview bundle."""
from pathlib import Path

root=Path("site")
css="/terravale-preview/navigation-refresh.css?v=20261101-nav1"
js="/terravale-preview/navigation-refresh.js?v=20261101-nav1"
stylesheet=f'<link rel="stylesheet" href="{css}">'
script=f'<script src="{js}" defer></script>'

for asset in ("navigation-refresh.css","navigation-refresh.js"):
    assert (root/asset).is_file() and (root/asset).stat().st_size>1000, f"Missing navigation asset: {asset}"

count=0
for page in root.rglob("*.html"):
    content=page.read_text()
    if "</head>" not in content:
        continue
    if stylesheet not in content:
        content=content.replace("</head>",stylesheet+script+"</head>",1)
        page.write_text(content)
    count+=1

assert count>=20, f"Expected the global sidebar on many Codex pages, found {count}"
for page in ["index.html","campaigns/index.html","shared-sidebar/index.html","party/index.html","characters/sheet-live/index.html"]:
    html=(root/page).read_text()
    assert css in html and js in html, f"Navigation assets absent from {page}"
assert 'data-tour-nav="/party"' in (root/"shared-sidebar/index.html").read_text(), "Lost session route"
assert 'codex-shared-sidebar-frame' in (root/"party/index.html").read_text(), "Session room shared sidebar missing"
assert 'html.live-embedded .sidebar' in (root/"characters/sheet-live/index.html").read_text(), "Embedded sheet regression"
print(f"PASS: navigation refresh linked on {count} pages without changing the compiled archive or character sheet structure")
