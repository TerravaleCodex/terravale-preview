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
/* Entire planner must share the palette; earlier patch only themed inner nodes. */
html[data-app-theme] .blood-tree-shell {
 --bf-canvas:color-mix(in srgb,var(--panel,#1b2631) 73%,var(--bg,#101720));
 --bf-node:color-mix(in srgb,var(--panel2,#23313f) 80%,var(--text,#f1e9dd) 20%);
 --bf-locked:color-mix(in srgb,var(--panel2,#23313f) 87%,var(--text,#f1e9dd) 13%);
 --bf-connector:color-mix(in srgb,var(--line,#354353) 50%,var(--muted,#a8b4c0) 50%);
 background:linear-gradient(145deg,var(--bf-surface),var(--bf-canvas))!important;
 border-color:var(--bf-edge)!important;color:var(--bf-text)!important;
}
html[data-app-theme] .blood-tree-heading h3{color:var(--bf-text)!important}
html[data-app-theme] .blood-tree-heading p{color:var(--bf-sub)!important}
html[data-app-theme] .tree-budget{
 background:linear-gradient(145deg,var(--bf-paper),var(--bf-surface))!important;
 border-color:var(--bf-edge)!important;color:var(--bf-accent)!important;
}
html[data-app-theme] .tree-budget strong{color:var(--bf-accent)!important}
html[data-app-theme] .tree-budget small{color:var(--bf-sub)!important}
html[data-app-theme] .tree-toolbar :is(input,select){
 background:var(--bf-canvas)!important;color:var(--bf-text)!important;
 border:1px solid var(--bf-edge)!important;border-radius:7px;
}
html[data-app-theme] .tree-toolbar .field-label{color:var(--bf-sub)!important}
html[data-app-theme] .tree-map-shell,html[data-app-theme] .tree-map-shell.tree-fullscreen{
 background:var(--bf-canvas)!important;
}
html[data-app-theme] .tree-map-top .tree-zoom{
 border-color:var(--bf-edge)!important;background:var(--bf-canvas)!important;
}
html[data-app-theme] .tree-map-top .tree-zoom button{
 color:var(--bf-text)!important;
}
html[data-app-theme] .tree-map-top .tree-zoom button:hover{
 background:var(--bf-paper)!important;
}
html[data-app-theme] .tree-node{
 background:var(--bf-node)!important;border-color:var(--bf-connector)!important;
}
html[data-app-theme] .tree-node.locked,
html[data-app-theme] .tree-node.tier-locked,
html[data-app-theme] .tree-node.no-points{
 background:var(--bf-locked)!important;
 border-color:var(--bf-connector)!important;
 opacity:.94!important;
}
html[data-app-theme] .tree-node.dimmed,
html[data-app-theme] .tree-node.locked.dimmed,
html[data-app-theme] .tree-node.tier-locked.dimmed,
html[data-app-theme] .tree-node.no-points.dimmed{
 opacity:.76!important;
}
html[data-app-theme] .tree-node.focused{
 opacity:1!important;
 box-shadow:0 0 0 2px color-mix(in srgb,var(--bf-accent) 20%,transparent)!important;
}
html[data-app-theme] .tree-node.dimmed:hover,
html[data-app-theme] .tree-node.locked:hover{opacity:1!important}
html[data-app-theme] .tree-stage {
 background-color:var(--bf-canvas)!important;
 background-image:radial-gradient(var(--bf-connector) .7px,transparent .7px)!important;
 background-size:26px 26px!important;
}
html[data-app-theme] .tree-footnote{
 border-color:var(--bf-edge)!important;
 color:var(--bf-sub)!important;
}
html[data-app-theme] .tree-connections path.bf2-muted{
 stroke:var(--bf-connector)!important;opacity:.54!important;
}
html[data-app-theme] .tree-connections .link-neutral,
html[data-app-theme] .tree-connections .link-ready{
 stroke:var(--bf-connector)!important;
}
html[data-app-theme] .tree-rule-copy{
 border-color:var(--bf-edge)!important;color:var(--bf-text)!important;
}
html[data-app-theme] .tree-detail-note {color:var(--bf-sub)!important}
html[data-app-theme] .tree-requirement .tree-branch-warning {color:var(--bf-accent)!important}
html[data-app-theme] .tree-swatch.is-available{
 background:color-mix(in srgb,var(--bf-accent) 28%,var(--bf-paper))!important;
 border-color:var(--bf-accent)!important;
}
html[data-app-theme] .tree-swatch.is-selected{
 background:var(--bf-picked)!important;border-color:var(--bf-accent)!important;
}
html[data-app-theme] .tree-swatch.is-locked{
 background:var(--bf-locked)!important;border-color:var(--bf-connector)!important;
}
html[data-app-theme] .tree-swatch.is-crown{
 background:var(--bf-accent)!important;border-color:var(--bf-accent)!important;
}
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
