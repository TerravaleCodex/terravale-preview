#!/usr/bin/env python3
"""Install Bloodforger V2's geometry as a presentation-only adapter in the exported Codex.

No compiled Next.js chunk, game data, authentication, or character records are changed.
The adapter calls the exact graph layout used by the approved isolated V2 workshop.
"""
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
site = root / "site"
demo = (root / "site-overrides" / "bloodforger-v2-demo.html").read_text()
adapter = (root / "site-overrides" / "bloodforger-v2-live-adapter.js").read_text()

assert "BLOODFORGER_V2_GRAPHS" in adapter
source = re.search(r'<script>\s*(.*?)\s*\(function\(\)\{\s*"use strict";', demo, re.S)
assert source, "V2 workshop layout source cannot be located"
layout = source.group(1).strip()
assert "function layoutSkillGraph(" in layout and "function roundedRoute(" in layout
data_match = re.search(r'<script type="application/json" id="graphdata">(.*?)</script>', demo, re.S)
assert data_match, "Original Bloodforger graph data missing"
graph = json.loads(data_match.group(1))
assert len(graph) == 13, "Original all-discipline graph data incomplete"
assert sum(len(x["nodes"]) for x in graph.values()) == 314, "Source node count has changed"
assert sum(len(x["edges"]) for x in graph.values()) == 336, "Source edge count has changed"

raw_json = json.dumps(graph, separators=(",", ":"), ensure_ascii=False).replace("<", "\\u003c")
compiled = (
    "/* Terravale Bloodforger V2 geometry — read-only presentation adapter */\n"
    + layout + "\nconst BLOODFORGER_V2_GRAPHS=" + raw_json + ";\n"
    + adapter
)
compiled_path = site / "bloodforger-v2-live.js"
compiled_path.write_text(compiled)

css = """/* Bloodforger V2-only visual controls; all other site UI untouched. */
.tree-map-shell .tree-zoom button[data-bf2-control] {
  font-size: 12px; min-height: 32px; padding: 5px 9px;
}
.tree-map-shell .tree-connections path.bf2-muted {
  opacity: .22 !important;
}
.tree-map-shell .tree-connections path.bf2-route {
  stroke: #e5b878 !important; stroke-width: 5px !important;
  opacity: 1 !important;
  stroke-linecap: round; stroke-linejoin: round;
  filter: drop-shadow(0 0 3px #d4a35d66);
}
.tree-map-shell .tree-connections path.link-active.bf2-route {
  stroke: #a1dfbd !important;
}
.tree-map-shell .tree-stage .tree-node {
  max-height: 104px;
  box-sizing: border-box;
}
.tree-map-shell .tree-zoom {flex-wrap:wrap}
@media(max-width:670px) {
  .tree-map-shell .tree-zoom {justify-content:space-between}
  .tree-map-shell .tree-zoom button[data-bf2-control] {padding:6px}
}
@media(prefers-reduced-motion:reduce) {
  .tree-map-shell .tree-connections path {transition:none !important}
}
"""

# The base tree palette predates unified Codex appearance. The live V2
# adapter is injected after the main CSS, so use active theme variables
# rather than freezing the nodes in dark blue and gold.
css += """
/* BLOODFORGER · Unified theme colours · applies to all ten Codex themes. */
html[data-app-theme] .blood-tree-shell {
 --bf-surface:var(--panel,#1b2631);
 --bf-paper:var(--panel2,#23313f);
 --bf-canvas:var(--bg,#101720);
 --bf-edge:var(--line,#354353);
 --bf-text:var(--text,#f1e9dd);
 --bf-sub:var(--muted,#a8b4c0);
 --bf-accent:var(--gold,#d7b579);
 --bf-picked:color-mix(in srgb,var(--gold,#d7b579) 28%,var(--panel2,#23313f));
}
html[data-app-theme] .tree-map-shell {
 background:var(--bf-canvas)!important;border-color:var(--bf-edge)!important;color:var(--bf-text);
}
html[data-app-theme] .tree-map-top,
html[data-app-theme] .tree-lane-label {
 background:var(--bf-paper)!important;color:var(--bf-accent)!important;border-color:var(--bf-edge)!important;
}
html[data-app-theme] .tree-map-top>span {color:var(--bf-sub)!important}
html[data-app-theme] .tree-stage {
 background-color:var(--bf-canvas)!important;
 background-image:radial-gradient(color-mix(in srgb,var(--bf-edge) 48%,transparent) 1px,transparent 1px)!important;
}
html[data-app-theme] .tree-scroll {scrollbar-color:var(--bf-edge) var(--bf-canvas)!important}
html[data-app-theme] .tree-node {
 background:var(--bf-paper)!important;border-color:var(--bf-edge)!important;
 color:var(--bf-text)!important;box-shadow:0 7px 16px #0004;
}
html[data-app-theme] .tree-node strong {color:var(--bf-text)!important}
html[data-app-theme] .tree-node small {color:var(--bf-sub)!important}
html[data-app-theme] .tree-node-top {color:var(--bf-accent)!important}
html[data-app-theme] .tree-node.available {
 background:color-mix(in srgb,var(--bf-accent) 13%,var(--bf-paper))!important;
 border-color:var(--bf-accent)!important;
}
html[data-app-theme] .tree-node.selected {
 background:var(--bf-picked)!important;border-color:var(--bf-accent)!important;
}
html[data-app-theme] .tree-node.locked,
html[data-app-theme] .tree-node.tier-locked,
html[data-app-theme] .tree-node.no-points {
 background:color-mix(in srgb,var(--bf-canvas) 65%,var(--bf-paper))!important;
 border-color:var(--bf-edge)!important;
}
html[data-app-theme] .tree-node.crown {border-color:var(--bf-accent)!important}
html[data-app-theme] .tree-node.focused {outline:3px solid var(--bf-accent)!important}
html[data-app-theme] .tree-inspector {
 background:linear-gradient(155deg,var(--bf-paper),var(--bf-surface))!important;
 border-color:var(--bf-edge)!important;color:var(--bf-text)!important;
}
html[data-app-theme] .tree-inspector h3 {color:var(--bf-accent)!important}
html[data-app-theme] .tree-detail-badges span {
 border-color:var(--bf-edge)!important;color:var(--bf-accent)!important;
}
html[data-app-theme] .tree-requirement {
 background:var(--bf-paper)!important;border-color:var(--bf-edge)!important;color:var(--bf-text)!important;
}
html[data-app-theme] .tree-requirement p {color:var(--bf-text)!important}
html[data-app-theme] .tree-rule-copy {color:var(--bf-text)!important}
html[data-app-theme] .tree-connections .link-neutral {stroke:var(--bf-edge)!important}
html[data-app-theme] .tree-connections .link-ready {stroke:var(--bf-accent)!important}
html[data-app-theme] .tree-connections .link-active {stroke:var(--bf-accent)!important}
html[data-app-theme] .tree-connections path.bf2-route {
 stroke:var(--bf-accent)!important;filter:none!important;
}
html[data-app-theme] .tree-connections path.link-active.bf2-route {
 stroke:color-mix(in srgb,var(--bf-accent) 75%,white)!important;
}
html[data-app-theme] .tree-legend {color:var(--bf-sub)!important}
"""

(site / "bloodforger-v2-live.css").write_text(css)
# All pages can navigate into the live tree without replacing React code.
# Defer script so the page's markup is present, then observe for client navigation.
snippet = (
    '<link rel="stylesheet" href="/terravale-preview/bloodforger-v2-live.css?v=20261101">'
    '<script src="/terravale-preview/bloodforger-v2-live.js?v=20261101" defer></script>'
)
written = 0
for page in site.rglob("*.html"):
    text = page.read_text(errors="replace")
    if "</head>" in text and "bloodforger-v2-live.js" not in text:
        page.write_text(text.replace("</head>", snippet + "</head>", 1))
        written += 1
assert written >= 10, "Unexpectedly few pages have been prepared"
tree_candidates = [
    p for p in site.rglob("*.html")
    if "bloodforger" in str(p).lower() and "trees" in str(p).lower()
]
assert tree_candidates, "Compiled live Bloodforger class-tree route is absent"
for page in tree_candidates:
    assert "bloodforger-v2-live.js" in page.read_text(), f"V2 not injected into {page}"
print("Bloodforger V2 live presentation adapter installed on", written, "pages.")
print("Live tree route candidates:", [str(p.relative_to(site)) for p in tree_candidates[:8]])
print("Preserved:", len(graph), "disciplines /", sum(len(x["nodes"]) for x in graph.values()), "nodes")
